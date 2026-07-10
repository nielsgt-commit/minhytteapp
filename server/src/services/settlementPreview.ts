// Settlement preview/close computation: head acceptance status, the split
// preview (custom policy via computePolicySplit, or the built-in legacy
// occupancy split), and persisting the accepted split when a settlement
// closes. Extracted verbatim from trpc/routers/settlement.ts — the router
// keeps zod input validation, authz, and acceptSplit's orchestration.
//
// Server-only: this module touches drizzle tables and throws TRPCError, so it
// must never be imported from server/src/shared (the isomorphic kernel).

import { and, eq, inArray, or } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import type { db as dbClient } from "../db/client.ts"
import {
  bookingOccupantsTable,
  bookingTable,
} from "../db/schema/booking.schema.ts"
import { propertyOwnersTable } from "../db/schema/property.schema.ts"
import {
  expensesTable,
  propertySplitPoliciesTable,
  settlementAcceptancesTable,
  settlementBookingAdjustmentsTable,
  settlementReviewsTable,
  settlementsTable,
  settlementTransfersTable,
  settlementUserGroupTotalsTable,
} from "../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
} from "../db/schema/users.schema.ts"
import { type Temporal, instantFromDate } from "../shared/temporal.ts"
import {
  SPLIT_POLICY_PARAMETERS,
  type SplitPolicyParameter,
  normalizeParameters,
} from "../shared/splitPolicy.ts"
import {
  type GroupAllocation,
  type SplitBreakdown,
  type Transfer,
  computePolicySplit,
  computeTransfers,
  inclusiveDayCount,
  loadSplitInput,
} from "./settlementSplit.ts"
import { listSettlementHeads } from "./settlementPhase.ts"

type Db = typeof dbClient

export type HeadStatus = {
  user_id: number
  user_name: string
  accepted: boolean
  accepted_at: Temporal.Instant | null
  review_done: boolean
}

export type PreviewResult = {
  policy: "occupancy_days" | "custom"
  policy_name: string | null
  parameters: SplitPolicyParameter[]
  inputs: {
    total_reimbursed: number
    total_booking_days: number | null
    expense_count: number
  }
  groups: GroupAllocation[]
  transfers: Transfer[]
  heads: HeadStatus[]
  closed: boolean
  breakdown: SplitBreakdown
}

export async function headStatuses(
  db: Db,
  settlementId: number,
  headsRows: { user_id: number; user_name: string }[],
): Promise<HeadStatus[]> {
  const acceptanceRows = await db
    .select({
      head_user_id: settlementAcceptancesTable.head_user_id,
      accepted_at: settlementAcceptancesTable.accepted_at,
    })
    .from(settlementAcceptancesTable)
    .where(eq(settlementAcceptancesTable.settlement_id, settlementId))
  const acceptanceByHead = new Map<number, Date>()
  for (const a of acceptanceRows) {
    acceptanceByHead.set(a.head_user_id, a.accepted_at)
  }
  const reviewRows = await db
    .select({
      head_user_id: settlementReviewsTable.head_user_id,
    })
    .from(settlementReviewsTable)
    .where(eq(settlementReviewsTable.settlement_id, settlementId))
  const reviewDoneHeads = new Set(reviewRows.map(r => r.head_user_id))
  return headsRows.map(h => {
    const at = acceptanceByHead.get(h.user_id)
    return {
      user_id: h.user_id,
      user_name: h.user_name,
      accepted: at != null,
      accepted_at: at != null ? instantFromDate(at) : null,
      review_done: reviewDoneHeads.has(h.user_id),
    }
  })
}

export async function computePreviewSplit(
  db: Db,
  settlementId: number,
): Promise<PreviewResult> {
  const settlement = (
    await db
      .select()
      .from(settlementsTable)
      .where(eq(settlementsTable.id, settlementId))
      .limit(1)
  ).at(0)
  if (settlement == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: "settlement not found" })
  }
  if (settlement.property_id == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "settlement is not linked to a property",
    })
  }
  const propertyId = settlement.property_id

  if (settlement.split_policy_id != null) {
    const policy = (
      await db
        .select({
          name: propertySplitPoliciesTable.name,
          config: propertySplitPoliciesTable.config,
        })
        .from(propertySplitPoliciesTable)
        .where(eq(propertySplitPoliciesTable.id, settlement.split_policy_id))
        .limit(1)
    ).at(0)
    if (policy != null) {
      const parameters = normalizeParameters(policy.config.parameters)
      const input = await loadSplitInput(
        db,
        { id: settlementId, property_id: propertyId, year: settlement.year },
        parameters,
      )
      const result = computePolicySplit(policy.config, input, parameters)
      const headsRows = await listSettlementHeads(db, propertyId)
      return {
        policy: "custom",
        policy_name: policy.name,
        parameters,
        inputs: {
          total_reimbursed: result.total_reimbursed,
          total_booking_days: result.total_booking_days,
          expense_count: result.expense_count,
        },
        groups: result.groups,
        transfers: computeTransfers(result.groups),
        heads: await headStatuses(db, settlementId, headsRows),
        closed: settlement.phase === "closed",
        breakdown: result.breakdown,
      }
    }
  }

  if (settlement.split_policy !== "occupancy_days") {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: `preview not implemented for policy: ${settlement.split_policy}`,
    })
  }

  const mainGroups = await db
    .selectDistinct({
      id: userGroupsTable.id,
      name: userGroupsTable.name,
    })
    .from(userGroupsTable)
    .innerJoin(
      propertyOwnersTable,
      eq(propertyOwnersTable.user_group_id, userGroupsTable.id),
    )
    .where(
      and(
        eq(propertyOwnersTable.property_id, propertyId),
        eq(userGroupsTable.is_family, true),
      ),
    )
  if (mainGroups.length === 0) {
    return {
      policy: "occupancy_days",
      policy_name: null,
      parameters: [...SPLIT_POLICY_PARAMETERS],
      inputs: { total_reimbursed: 0, total_booking_days: 0, expense_count: 0 },
      groups: [],
      transfers: [],
      heads: [],
      closed: settlement.phase === "closed",
      breakdown: { buckets: [], rounding: null, occupancy: null },
    }
  }

  const groupIds = mainGroups.map(g => g.id)
  const memberRows = await db
    .select({
      user_group_id: userGroupMembersTable.user_group_id,
      user_id: userGroupMembersTable.user_id,
    })
    .from(userGroupMembersTable)
    .where(inArray(userGroupMembersTable.user_group_id, groupIds))

  const userToGroup = new Map<number, number>()
  for (const m of memberRows) {
    userToGroup.set(m.user_id, m.user_group_id)
  }

  const headsRows = await listSettlementHeads(db, propertyId)
  const headIds = headsRows.map(h => h.user_id)

  const reimbursedRows = await db
    .select({
      amount: expensesTable.amount,
      reimbursed_by_id: expensesTable.reimbursed_by_id,
      payer_id: expensesTable.payer_id,
    })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.settlement_id, settlementId),
        or(
          eq(expensesTable.status, "reimbursed"),
          headIds.length > 0
            ? and(
                eq(expensesTable.status, "submitted"),
                inArray(expensesTable.payer_id, headIds),
              )
            : undefined,
        ),
      ),
    )

  const paidByGroup = new Map<number, number>()
  let totalReimbursed = 0
  for (const e of reimbursedRows) {
    totalReimbursed += e.amount
    const effectivePayer = e.reimbursed_by_id ?? e.payer_id
    const groupId = userToGroup.get(effectivePayer)
    if (groupId == null) continue
    paidByGroup.set(groupId, (paidByGroup.get(groupId) ?? 0) + e.amount)
  }

  const bookings = await db
    .select({
      id: bookingTable.id,
      booker_id: bookingTable.booker_id,
      start_date: bookingTable.start_date,
      end_date: bookingTable.end_date,
      status: bookingTable.status,
    })
    .from(bookingTable)
    .where(eq(bookingTable.property_id, propertyId))
  const adjustmentRows = await db
    .select({
      booking_id: settlementBookingAdjustmentsTable.booking_id,
      excluded: settlementBookingAdjustmentsTable.excluded,
      extra_names: settlementBookingAdjustmentsTable.extra_names,
    })
    .from(settlementBookingAdjustmentsTable)
    .where(eq(settlementBookingAdjustmentsTable.settlement_id, settlementId))
  const adjustmentsByBooking = new Map(
    adjustmentRows.map(a => [a.booking_id, a]),
  )
  const eligible = bookings.filter(b => {
    if (b.status === "cancelled") return false
    return !(adjustmentsByBooking.get(b.id)?.excluded ?? false)
  })
  const bookingIds = eligible.map(b => b.id)
  const occupants = bookingIds.length
    ? await db
        .select({
          booking_id: bookingOccupantsTable.booking_id,
          user_id: bookingOccupantsTable.user_id,
        })
        .from(bookingOccupantsTable)
        .where(inArray(bookingOccupantsTable.booking_id, bookingIds))
    : []
  const occupantsByBooking = new Map<number, number[]>()
  for (const o of occupants) {
    const list = occupantsByBooking.get(o.booking_id) ?? []
    list.push(o.user_id)
    occupantsByBooking.set(o.booking_id, list)
  }

  const daysByGroup = new Map<number, number>()
  for (const b of eligible) {
    const days = inclusiveDayCount(b.start_date, b.end_date)
    const occList = occupantsByBooking.get(b.id) ?? []
    for (const userId of occList) {
      const g = userToGroup.get(userId)
      if (g == null) continue
      daysByGroup.set(g, (daysByGroup.get(g) ?? 0) + days)
    }
    const extras = adjustmentsByBooking.get(b.id)?.extra_names ?? []
    if (extras.length > 0) {
      const bookerGroup = userToGroup.get(b.booker_id)
      if (bookerGroup != null) {
        daysByGroup.set(
          bookerGroup,
          (daysByGroup.get(bookerGroup) ?? 0) + extras.length * days,
        )
      }
    }
  }
  const totalDays = [...daysByGroup.values()].reduce((s, v) => s + v, 0)

  const allocations: GroupAllocation[] = mainGroups.map(g => {
    const days = daysByGroup.get(g.id) ?? 0
    const paid = paidByGroup.get(g.id) ?? 0
    const share =
      totalDays > 0 ? Math.round((days * totalReimbursed) / totalDays) : 0
    return {
      group_id: g.id,
      group_name: g.name,
      booking_days: days,
      total_paid: paid,
      total_share: share,
      net: paid - share,
    }
  })

  const sumShares = allocations.reduce((s, a) => s + a.total_share, 0)
  const drift = totalReimbursed - sumShares
  let rounding: SplitBreakdown["rounding"] = null
  if (drift !== 0 && allocations.length > 0) {
    let largest = allocations[0]
    for (const a of allocations) {
      if ((a.booking_days ?? 0) > (largest.booking_days ?? 0)) largest = a
    }
    largest.total_share += drift
    largest.net = largest.total_paid - largest.total_share
    rounding = { group_id: largest.group_id, amount: drift }
  }

  return {
    policy: "occupancy_days",
    policy_name: null,
    parameters: [...SPLIT_POLICY_PARAMETERS],
    inputs: {
      total_reimbursed: totalReimbursed,
      total_booking_days: totalDays,
      expense_count: reimbursedRows.length,
    },
    groups: allocations,
    transfers: computeTransfers(allocations),
    heads: await headStatuses(db, settlementId, headsRows),
    closed: settlement.phase === "closed",
    breakdown: {
      buckets:
        totalReimbursed > 0
          ? [
              {
                rule_index: null,
                category_names: null,
                how: "weighted_by_occupancy",
                expense_count: reimbursedRows.length,
                amount: totalReimbursed,
                weights: allocations.map(a => ({
                  group_id: a.group_id,
                  weight: a.booking_days ?? 0,
                })),
              },
            ]
          : [],
      rounding,
      // The built-in policy counts every night in the year and always adds
      // extra guest names to the booker's household.
      occupancy: {
        window: { kind: "year" },
        include_extra_guests: true,
        child_weight: 1,
      },
    },
  }
}

// Close the settlement and persist the accepted split: compare-and-swap the
// phase from split_policy to closed, then write the per-group totals and the
// pending transfers. Returns false if the phase moved concurrently.
export async function persistClosedSplit(
  db: Db,
  settlementId: number,
  preview: PreviewResult,
): Promise<boolean> {
  return db.transaction(async tx => {
    const updated = (
      await tx
        .update(settlementsTable)
        .set({
          phase: "closed",
          status: "closed",
          closed_at: new Date(),
        })
        .where(
          and(
            eq(settlementsTable.id, settlementId),
            eq(settlementsTable.phase, "split_policy"),
          ),
        )
        .returning()
    ).at(0)
    if (updated == null) return false

    if (preview.groups.length > 0) {
      await tx
        .insert(settlementUserGroupTotalsTable)
        .values(
          preview.groups.map(g => ({
            settlement_id: settlementId,
            user_group_id: g.group_id,
            total_paid: g.total_paid,
            total_share: g.total_share,
            net: g.net,
          })),
        )
        .onConflictDoNothing()
    }
    if (preview.transfers.length > 0) {
      await tx.insert(settlementTransfersTable).values(
        preview.transfers.map(t => ({
          settlement_id: settlementId,
          from_user_group_id: t.from_group_id,
          to_user_group_id: t.to_group_id,
          amount: t.amount,
          status: "pending" as const,
        })),
      )
    }
    return true
  })
}
