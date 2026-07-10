// Settlement phase machinery: which phases a settlement's policy requires,
// who its heads are, and the guarded phase transitions with their side
// effects. Extracted verbatim from trpc/routers/settlement.ts — the router
// keeps zod input validation, authz (member/head checks), and toWire mapping.
//
// Server-only: this module touches drizzle tables and throws TRPCError, so it
// must never be imported from server/src/shared (the isomorphic kernel).

import { and, eq, inArray, isNull } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import type { db as dbClient } from "../db/client.ts"
import {
  expensesTable,
  propertySplitPoliciesTable,
  settlementAcceptancesTable,
  settlementsTable,
} from "../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../db/schema/users.schema.ts"
import {
  SPLIT_POLICY_PARAMETERS,
  type SettlementPhase,
  type SplitPolicyParameter,
  nextPhaseIn,
  normalizeParameters,
  prevPhaseIn,
  requiredPhases,
} from "../shared/splitPolicy.ts"

type Db = typeof dbClient

// Which phases a settlement needs is defined by its policy's parameters; a
// settlement without a custom policy uses the built-in occupancy flow with
// every phase.
export async function resolveSettlementParameters(
  db: Db,
  splitPolicyId: number | null,
): Promise<SplitPolicyParameter[]> {
  if (splitPolicyId == null) return [...SPLIT_POLICY_PARAMETERS]
  const policy = (
    await db
      .select({ config: propertySplitPoliciesTable.config })
      .from(propertySplitPoliciesTable)
      .where(eq(propertySplitPoliciesTable.id, splitPolicyId))
      .limit(1)
  ).at(0)
  if (policy == null) return [...SPLIT_POLICY_PARAMETERS]
  return normalizeParameters(policy.config.parameters)
}

export async function listSettlementHeads(db: Db, propertyId: number) {
  return db
    .selectDistinct({
      user_id: usersTable.id,
      user_name: usersTable.name,
    })
    .from(usersTable)
    .innerJoin(
      userGroupMembersTable,
      eq(userGroupMembersTable.user_id, usersTable.id),
    )
    .innerJoin(
      userGroupsTable,
      eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
    )
    .where(
      and(
        eq(userGroupsTable.property_id, propertyId),
        eq(userGroupsTable.is_family, true),
        eq(userGroupMembersTable.is_head, true),
      ),
    )
}

export async function assertCanEditBookingAdjustments(
  db: Db,
  settlementId: number,
  userId: number,
  isHead: boolean,
) {
  if (!isHead) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "only heads can edit booking adjustments",
    })
  }
  const settlement = (
    await db
      .select({
        phase: settlementsTable.phase,
        property_id: settlementsTable.property_id,
      })
      .from(settlementsTable)
      .where(eq(settlementsTable.id, settlementId))
      .limit(1)
  ).at(0)
  if (settlement == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: "settlement not found" })
  }
  if (
    settlement.phase !== "collecting_expenses" &&
    settlement.phase !== "collecting_bookings"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `cannot edit booking adjustments while phase is ${settlement.phase}`,
    })
  }
  if (settlement.property_id == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "settlement is not linked to a property",
    })
  }
  const heads = await listSettlementHeads(db, settlement.property_id)
  if (!heads.some(h => h.user_id === userId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "only heads of this property can edit booking adjustments",
    })
  }
}

// Guarded forward transition. Validates the step against the policy's
// required phases, applies it with a compare-and-swap (CONFLICT on a lost
// race), and runs the entering-review side effect. Returns the raw updated
// settlement row; the router maps it to the wire shape.
//
// Note: the phase update and the expense pull are deliberately two separate
// statements, not one transaction — preserved as-is from the router; wrapping
// them changes failure semantics and belongs in its own change.
export async function advanceSettlementPhase(
  db: Db,
  opts: {
    settlementId: number
    propertyId: number
    from: SettlementPhase
    to: SettlementPhase
  },
) {
  const { settlementId, propertyId, from, to } = opts
  const row = (
    await db
      .select({ split_policy_id: settlementsTable.split_policy_id })
      .from(settlementsTable)
      .where(eq(settlementsTable.id, settlementId))
      .limit(1)
  ).at(0)
  const parameters = await resolveSettlementParameters(
    db,
    row?.split_policy_id ?? null,
  )
  const expectedNext = nextPhaseIn(requiredPhases(parameters), from)
  if (expectedNext == null || expectedNext !== to) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `cannot advance from ${from} to ${to}`,
    })
  }
  const updated = (
    await db
      .update(settlementsTable)
      .set({ phase: to })
      .where(
        and(
          eq(settlementsTable.id, settlementId),
          eq(settlementsTable.phase, from),
        ),
      )
      .returning()
  ).at(0)
  if (updated == null) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "settlement phase changed concurrently",
    })
  }
  // Entering review pulls the heads' still-submitted expenses into the pot
  // by default, so the review screen's Include switch starts on. A head can
  // still exclude any of them there (which nulls the link again).
  if (to === "reviewing") {
    const headIds = (await listSettlementHeads(db, propertyId)).map(
      h => h.user_id,
    )
    if (headIds.length > 0) {
      await db
        .update(expensesTable)
        .set({ settlement_id: settlementId })
        .where(
          and(
            eq(expensesTable.property_id, propertyId),
            eq(expensesTable.status, "submitted"),
            inArray(expensesTable.payer_id, headIds),
            isNull(expensesTable.settlement_id),
          ),
        )
    }
  }
  return updated
}

// Guarded backward transition. Leaving split_policy clears the acceptance
// round so heads must re-accept after any change. Returns the raw updated
// settlement row.
export async function regressSettlementPhase(
  db: Db,
  opts: { settlementId: number; from: SettlementPhase; to: SettlementPhase },
) {
  const { settlementId, from, to } = opts
  const row = (
    await db
      .select({ split_policy_id: settlementsTable.split_policy_id })
      .from(settlementsTable)
      .where(eq(settlementsTable.id, settlementId))
      .limit(1)
  ).at(0)
  const parameters = await resolveSettlementParameters(
    db,
    row?.split_policy_id ?? null,
  )
  const expectedPrev = prevPhaseIn(requiredPhases(parameters), from)
  if (expectedPrev == null || expectedPrev !== to) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `cannot regress from ${from} to ${to}`,
    })
  }
  const clearAcceptances = from === "split_policy"
  const updated = await db.transaction(async tx => {
    const row = (
      await tx
        .update(settlementsTable)
        .set({ phase: to })
        .where(
          and(
            eq(settlementsTable.id, settlementId),
            eq(settlementsTable.phase, from),
          ),
        )
        .returning()
    ).at(0)
    if (row == null) return null
    if (clearAcceptances) {
      await tx
        .delete(settlementAcceptancesTable)
        .where(eq(settlementAcceptancesTable.settlement_id, settlementId))
    }
    return row
  })
  if (!updated) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "settlement phase changed concurrently",
    })
  }
  return updated
}
