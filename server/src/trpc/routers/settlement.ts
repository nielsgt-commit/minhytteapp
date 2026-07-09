import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import {
  bookingOccupantsTable,
  bookingTable,
} from "../../db/schema/booking.schema.ts"
import { propertyOwnersTable } from "../../db/schema/property.schema.ts"
import {
  expensesTable,
  propertySplitPoliciesTable,
  settlementAcceptancesTable,
  settlementBookingAdjustmentsTable,
  settlementReviewsTable,
  settlementsTable,
  settlementTransfersTable,
  settlementUserGroupTotalsTable,
} from "../../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import {
  type Temporal,
  instantFromDate,
  instantFromDateOrNull,
} from "../../shared/temporal.ts"
import {
  SETTLEMENT_PHASES,
  SPLIT_POLICY_PARAMETERS,
  type SplitPolicyParameter,
  nextPhaseIn,
  normalizeParameters,
  prevPhaseIn,
  requiredPhases,
} from "../../shared/splitPolicy.ts"
import {
  type GroupAllocation,
  type SplitBreakdown,
  type Transfer,
  computePolicySplit,
  computeTransfers,
  inclusiveDayCount,
  loadSplitInput,
} from "../../services/settlementSplit.ts"
import {
  assertPropertyHead,
  assertPropertyMember,
  isPropertyHead,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"

type Db = typeof dbClient

// Wire mapping: settlement timestamp columns → Temporal.Instant.
function toWireSettlement<
  T extends { opened_at: Date; closed_at: Date | null },
>(
  s: T,
): Omit<T, "opened_at" | "closed_at"> & {
  opened_at: Temporal.Instant
  closed_at: Temporal.Instant | null
} {
  return {
    ...s,
    opened_at: instantFromDate(s.opened_at),
    closed_at: instantFromDateOrNull(s.closed_at),
  }
}

// Wire mapping: settlement transfer paid_at → Temporal.Instant | null.
function toWireTransfer<T extends { paid_at: Date | null }>(
  t: T,
): Omit<T, "paid_at"> & { paid_at: Temporal.Instant | null } {
  return { ...t, paid_at: instantFromDateOrNull(t.paid_at) }
}

const phaseEnum = z.enum(SETTLEMENT_PHASES)

// Which phases a settlement needs is defined by its policy's parameters; a
// settlement without a custom policy uses the built-in occupancy flow with
// every phase.
async function resolveSettlementParameters(
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

type HeadStatus = {
  user_id: number
  user_name: string
  accepted: boolean
  accepted_at: Temporal.Instant | null
  review_done: boolean
}

type PreviewResult = {
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

async function resolveSettlementPropertyId(
  db: Db,
  settlementId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: settlementsTable.property_id })
      .from(settlementsTable)
      .where(eq(settlementsTable.id, settlementId))
      .limit(1)
  ).at(0)
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "settlement not found" })
  }
  if (row.property_id == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "settlement is not linked to a property",
    })
  }
  return row.property_id
}

async function resolveTransferPropertyId(
  db: Db,
  transferId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: settlementsTable.property_id })
      .from(settlementTransfersTable)
      .innerJoin(
        settlementsTable,
        eq(settlementsTable.id, settlementTransfersTable.settlement_id),
      )
      .where(eq(settlementTransfersTable.id, transferId))
      .limit(1)
  ).at(0)
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "transfer not found" })
  }
  if (row.property_id == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "settlement is not linked to a property",
    })
  }
  return row.property_id
}

async function listSettlementHeads(db: Db, propertyId: number) {
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

async function assertCanEditBookingAdjustments(
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

async function headStatuses(
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

async function computePreviewSplit(
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

const settlementFields = {
  property_id: z.number().int().positive(),
  year: z.number().int(),
  season: z.enum(["winter", "spring", "summer", "autumn"]).optional(),
  status: z.enum(["open", "closed"]),
  split_policy: z.enum(["shares", "groups_equal", "occupancy_days"]),
  split_policy_id: z.number().int().positive().nullable().optional(),
}

const createInput = z.object(settlementFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...settlementFields,
})

export const settlementRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      const rows = await ctx.db
        .select({
          id: settlementsTable.id,
          property_id: settlementsTable.property_id,
          year: settlementsTable.year,
          season: settlementsTable.season,
          status: settlementsTable.status,
          phase: settlementsTable.phase,
          split_policy: settlementsTable.split_policy,
          split_policy_id: settlementsTable.split_policy_id,
          created_by_id: settlementsTable.created_by_id,
          created_by_name: usersTable.name,
          opened_at: settlementsTable.opened_at,
          closed_at: settlementsTable.closed_at,
        })
        .from(settlementsTable)
        .leftJoin(usersTable, eq(usersTable.id, settlementsTable.created_by_id))
        .where(eq(settlementsTable.property_id, input.property_id))
        .orderBy(asc(settlementsTable.year))
      return rows.map(toWireSettlement)
    }),

  create: propertyAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(settlementsTable)
        .values({
          ...input,
          created_by_id: ctx.user.id,
          closed_at: input.status === "closed" ? new Date() : null,
        })
        .returning()
      return toWireSettlement(created)
    }),

  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolveSettlementPropertyId(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "cannot reassign settlement to another property",
        })
      }
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(settlementsTable)
        .set({
          ...rest,
          closed_at: rest.status === "closed" ? new Date() : null,
        })
        .where(eq(settlementsTable.id, id))
        .returning()
      return toWireSettlement(updated)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(ctx.db, input.id)
      await assertPropertyHead(ctx.db, ctx.user, propertyId)
      const [deleted] = await ctx.db
        .delete(settlementsTable)
        .where(eq(settlementsTable.id, input.id))
        .returning()
      return toWireSettlement(deleted)
    }),

  previewSplit: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      return computePreviewSplit(ctx.db, input.id)
    }),

  acceptSplit: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const settlement = (
        await ctx.db
          .select()
          .from(settlementsTable)
          .where(eq(settlementsTable.id, input.id))
          .limit(1)
      ).at(0)
      if (settlement == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "settlement not found",
        })
      }
      if (settlement.property_id != null) {
        if (!(await isPropertyHead(ctx.db, ctx.user, settlement.property_id))) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "only heads can accept the split",
          })
        }
      }
      if (settlement.phase !== "split_policy") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `cannot accept while phase is ${settlement.phase}`,
        })
      }
      if (settlement.property_id == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "settlement is not linked to a property",
        })
      }
      const propertyId = settlement.property_id
      await assertPropertyMember(ctx.db, ctx.user, propertyId)

      const heads = await listSettlementHeads(ctx.db, propertyId)
      if (!heads.some(h => h.user_id === ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads of this property can accept",
        })
      }

      await ctx.db
        .insert(settlementAcceptancesTable)
        .values({
          settlement_id: input.id,
          head_user_id: ctx.user.id,
        })
        .onConflictDoNothing()

      const acceptanceRows = await ctx.db
        .select({
          head_user_id: settlementAcceptancesTable.head_user_id,
        })
        .from(settlementAcceptancesTable)
        .where(eq(settlementAcceptancesTable.settlement_id, input.id))
      const acceptedCount = acceptanceRows.length
      const headsCount = heads.length

      if (acceptedCount < headsCount) {
        return {
          accepted_count: acceptedCount,
          heads_count: headsCount,
          closed: false,
        }
      }

      const preview = await computePreviewSplit(ctx.db, input.id)

      const closed = await ctx.db.transaction(async tx => {
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
                eq(settlementsTable.id, input.id),
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
                settlement_id: input.id,
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
              settlement_id: input.id,
              from_user_group_id: t.from_group_id,
              to_user_group_id: t.to_group_id,
              amount: t.amount,
              status: "pending" as const,
            })),
          )
        }
        return true
      })

      return {
        accepted_count: acceptedCount,
        heads_count: headsCount,
        closed,
      }
    }),

  setMyReviewProgress: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        done: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const settlement = (
        await ctx.db
          .select()
          .from(settlementsTable)
          .where(eq(settlementsTable.id, input.id))
          .limit(1)
      ).at(0)
      if (settlement == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "settlement not found",
        })
      }
      if (settlement.property_id == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "settlement is not linked to a property",
        })
      }
      const propertyId = settlement.property_id
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      if (!(await isPropertyHead(ctx.db, ctx.user, propertyId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can update review progress",
        })
      }

      const heads = await listSettlementHeads(ctx.db, propertyId)
      if (!heads.some(h => h.user_id === ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads of this property can update review progress",
        })
      }

      if (input.done) {
        await ctx.db
          .insert(settlementReviewsTable)
          .values({
            settlement_id: input.id,
            head_user_id: ctx.user.id,
          })
          .onConflictDoNothing()
      } else {
        await ctx.db
          .delete(settlementReviewsTable)
          .where(
            and(
              eq(settlementReviewsTable.settlement_id, input.id),
              eq(settlementReviewsTable.head_user_id, ctx.user.id),
            ),
          )
      }

      return { id: input.id, done: input.done }
    }),

  getBookingAdjustments: protectedProcedure
    .input(z.object({ settlementId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(
        ctx.db,
        input.settlementId,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      return ctx.db
        .select({
          booking_id: settlementBookingAdjustmentsTable.booking_id,
          excluded: settlementBookingAdjustmentsTable.excluded,
          extra_names: settlementBookingAdjustmentsTable.extra_names,
        })
        .from(settlementBookingAdjustmentsTable)
        .where(
          eq(
            settlementBookingAdjustmentsTable.settlement_id,
            input.settlementId,
          ),
        )
    }),

  setBookingExcluded: protectedProcedure
    .input(
      z.object({
        settlementId: z.number().int().positive(),
        bookingId: z.number().int().positive(),
        excluded: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(
        ctx.db,
        input.settlementId,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      await assertCanEditBookingAdjustments(
        ctx.db,
        input.settlementId,
        ctx.user.id,
        await isPropertyHead(ctx.db, ctx.user, propertyId),
      )
      await ctx.db
        .insert(settlementBookingAdjustmentsTable)
        .values({
          settlement_id: input.settlementId,
          booking_id: input.bookingId,
          excluded: input.excluded,
        })
        .onConflictDoUpdate({
          target: [
            settlementBookingAdjustmentsTable.settlement_id,
            settlementBookingAdjustmentsTable.booking_id,
          ],
          set: { excluded: input.excluded },
        })
      return {
        settlement_id: input.settlementId,
        booking_id: input.bookingId,
        excluded: input.excluded,
      }
    }),

  setBookingExtras: protectedProcedure
    .input(
      z.object({
        settlementId: z.number().int().positive(),
        bookingId: z.number().int().positive(),
        names: z.array(z.string().min(1).max(100)).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(
        ctx.db,
        input.settlementId,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      await assertCanEditBookingAdjustments(
        ctx.db,
        input.settlementId,
        ctx.user.id,
        await isPropertyHead(ctx.db, ctx.user, propertyId),
      )
      await ctx.db
        .insert(settlementBookingAdjustmentsTable)
        .values({
          settlement_id: input.settlementId,
          booking_id: input.bookingId,
          extra_names: input.names,
        })
        .onConflictDoUpdate({
          target: [
            settlementBookingAdjustmentsTable.settlement_id,
            settlementBookingAdjustmentsTable.booking_id,
          ],
          set: { extra_names: input.names },
        })
      return {
        settlement_id: input.settlementId,
        booking_id: input.bookingId,
        extra_names: input.names,
      }
    }),

  getClosedSummary: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const settlement = (
        await ctx.db
          .select({
            id: settlementsTable.id,
            year: settlementsTable.year,
            season: settlementsTable.season,
            status: settlementsTable.status,
            closed_at: settlementsTable.closed_at,
            split_policy: settlementsTable.split_policy,
            split_policy_id: settlementsTable.split_policy_id,
            split_policy_name: propertySplitPoliciesTable.name,
          })
          .from(settlementsTable)
          .leftJoin(
            propertySplitPoliciesTable,
            eq(propertySplitPoliciesTable.id, settlementsTable.split_policy_id),
          )
          .where(eq(settlementsTable.id, input.id))
          .limit(1)
      ).at(0)
      if (settlement == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "settlement not found",
        })
      }
      if (settlement.status !== "closed") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "settlement is not closed",
        })
      }

      const fromGroups = alias(userGroupsTable, "from_groups")
      const toGroups = alias(userGroupsTable, "to_groups")

      const myMemberships = await ctx.db
        .select({ user_group_id: userGroupMembersTable.user_group_id })
        .from(userGroupMembersTable)
        .where(eq(userGroupMembersTable.user_id, ctx.user.id))
      const myGroupIds = new Set(myMemberships.map(m => m.user_group_id))
      const canMarkAnyPaid = await isPropertyHead(ctx.db, ctx.user, propertyId)

      const [groups, transfers] = await Promise.all([
        ctx.db
          .select({
            user_group_id: settlementUserGroupTotalsTable.user_group_id,
            group_name: userGroupsTable.name,
            total_paid: settlementUserGroupTotalsTable.total_paid,
            total_share: settlementUserGroupTotalsTable.total_share,
            net: settlementUserGroupTotalsTable.net,
          })
          .from(settlementUserGroupTotalsTable)
          .innerJoin(
            userGroupsTable,
            eq(
              userGroupsTable.id,
              settlementUserGroupTotalsTable.user_group_id,
            ),
          )
          .where(
            eq(settlementUserGroupTotalsTable.settlement_id, settlement.id),
          )
          .orderBy(asc(userGroupsTable.name)),
        ctx.db
          .select({
            id: settlementTransfersTable.id,
            from_group_id: settlementTransfersTable.from_user_group_id,
            from_group_name: fromGroups.name,
            to_group_id: settlementTransfersTable.to_user_group_id,
            to_group_name: toGroups.name,
            amount: settlementTransfersTable.amount,
            status: settlementTransfersTable.status,
            paid_at: settlementTransfersTable.paid_at,
          })
          .from(settlementTransfersTable)
          .innerJoin(
            fromGroups,
            eq(fromGroups.id, settlementTransfersTable.from_user_group_id),
          )
          .innerJoin(
            toGroups,
            eq(toGroups.id, settlementTransfersTable.to_user_group_id),
          )
          .where(eq(settlementTransfersTable.settlement_id, settlement.id))
          .orderBy(asc(settlementTransfersTable.id)),
      ])

      return {
        id: settlement.id,
        year: settlement.year,
        season: settlement.season,
        closed_at: instantFromDateOrNull(settlement.closed_at),
        split_policy: settlement.split_policy,
        split_policy_id: settlement.split_policy_id,
        split_policy_name: settlement.split_policy_name,
        groups,
        transfers: transfers.map(t => ({
          ...toWireTransfer(t),
          can_mark_paid:
            canMarkAnyPaid &&
            t.status === "pending" &&
            myGroupIds.has(t.to_group_id),
        })),
      }
    }),

  markTransferPaid: protectedProcedure
    .input(z.object({ transferId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolveTransferPropertyId(
        ctx.db,
        input.transferId,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const transfer = (
        await ctx.db
          .select({
            id: settlementTransfersTable.id,
            settlement_id: settlementTransfersTable.settlement_id,
            to_user_group_id: settlementTransfersTable.to_user_group_id,
            status: settlementTransfersTable.status,
          })
          .from(settlementTransfersTable)
          .where(eq(settlementTransfersTable.id, input.transferId))
          .limit(1)
      ).at(0)
      if (transfer == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "transfer not found",
        })
      }
      if (!(await isPropertyHead(ctx.db, ctx.user, propertyId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can mark transfers paid",
        })
      }
      const membership = (
        await ctx.db
          .select({ user_id: userGroupMembersTable.user_id })
          .from(userGroupMembersTable)
          .where(
            and(
              eq(userGroupMembersTable.user_id, ctx.user.id),
              eq(
                userGroupMembersTable.user_group_id,
                transfer.to_user_group_id,
              ),
            ),
          )
          .limit(1)
      ).at(0)
      if (membership == null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only the recipient group can mark this transfer paid",
        })
      }
      if (transfer.status === "paid") {
        const [existing] = await ctx.db
          .select()
          .from(settlementTransfersTable)
          .where(eq(settlementTransfersTable.id, input.transferId))
          .limit(1)
        return toWireTransfer(existing)
      }
      const [updated] = await ctx.db
        .update(settlementTransfersTable)
        .set({ status: "paid", paid_at: new Date() })
        .where(eq(settlementTransfersTable.id, input.transferId))
        .returning()
      return toWireTransfer(updated)
    }),

  advancePhase: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        from: phaseEnum,
        to: phaseEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      if (!(await isPropertyHead(ctx.db, ctx.user, propertyId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can advance settlement phase",
        })
      }
      const row = (
        await ctx.db
          .select({ split_policy_id: settlementsTable.split_policy_id })
          .from(settlementsTable)
          .where(eq(settlementsTable.id, input.id))
          .limit(1)
      ).at(0)
      const parameters = await resolveSettlementParameters(
        ctx.db,
        row?.split_policy_id ?? null,
      )
      const expectedNext = nextPhaseIn(requiredPhases(parameters), input.from)
      if (expectedNext == null || expectedNext !== input.to) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `cannot advance from ${input.from} to ${input.to}`,
        })
      }
      const updated = (
        await ctx.db
          .update(settlementsTable)
          .set({ phase: input.to })
          .where(
            and(
              eq(settlementsTable.id, input.id),
              eq(settlementsTable.phase, input.from),
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
      if (input.to === "reviewing") {
        const headIds = (await listSettlementHeads(ctx.db, propertyId)).map(
          h => h.user_id,
        )
        if (headIds.length > 0) {
          await ctx.db
            .update(expensesTable)
            .set({ settlement_id: input.id })
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
      return toWireSettlement(updated)
    }),

  regressPhase: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        from: phaseEnum,
        to: phaseEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolveSettlementPropertyId(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      if (!(await isPropertyHead(ctx.db, ctx.user, propertyId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can regress settlement phase",
        })
      }
      const row = (
        await ctx.db
          .select({ split_policy_id: settlementsTable.split_policy_id })
          .from(settlementsTable)
          .where(eq(settlementsTable.id, input.id))
          .limit(1)
      ).at(0)
      const parameters = await resolveSettlementParameters(
        ctx.db,
        row?.split_policy_id ?? null,
      )
      const expectedPrev = prevPhaseIn(requiredPhases(parameters), input.from)
      if (expectedPrev == null || expectedPrev !== input.to) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `cannot regress from ${input.from} to ${input.to}`,
        })
      }
      const clearAcceptances = input.from === "split_policy"
      const updated = await ctx.db.transaction(async tx => {
        const row = (
          await tx
            .update(settlementsTable)
            .set({ phase: input.to })
            .where(
              and(
                eq(settlementsTable.id, input.id),
                eq(settlementsTable.phase, input.from),
              ),
            )
            .returning()
        ).at(0)
        if (row == null) return null
        if (clearAcceptances) {
          await tx
            .delete(settlementAcceptancesTable)
            .where(eq(settlementAcceptancesTable.settlement_id, input.id))
        }
        return row
      })
      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "settlement phase changed concurrently",
        })
      }
      return toWireSettlement(updated)
    }),
})
