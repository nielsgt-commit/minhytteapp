import { and, asc, eq, inArray } from "drizzle-orm"
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
  settlementsTable,
  settlementTransfersTable,
  settlementUserGroupTotalsTable,
} from "../../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

type Db = typeof dbClient

const PHASES = [
  "collecting_expenses",
  "collecting_bookings",
  "reviewing",
  "split_policy",
  "closed",
] as const

type Phase = (typeof PHASES)[number]

const phaseEnum = z.enum(PHASES)

const NEXT_PHASE: Record<Phase, Phase | null> = {
  collecting_expenses: "collecting_bookings",
  collecting_bookings: "reviewing",
  reviewing: "split_policy",
  split_policy: null,
  closed: null,
}

const PREV_PHASE: Record<Phase, Phase | null> = {
  collecting_expenses: null,
  collecting_bookings: "collecting_expenses",
  reviewing: "collecting_bookings",
  split_policy: "reviewing",
  closed: null,
}

type GroupAllocation = {
  group_id: number
  group_name: string
  booking_days: number
  total_paid: number
  total_share: number
  net: number
}

type Transfer = {
  from_group_id: number
  from_group_name: string
  to_group_id: number
  to_group_name: string
  amount: number
}

type HeadStatus = {
  user_id: number
  user_name: string
  accepted: boolean
  accepted_at: string | null
}

type PreviewResult = {
  policy: "occupancy_days"
  inputs: {
    total_reimbursed: number
    total_booking_days: number
  }
  groups: GroupAllocation[]
  transfers: Transfer[]
  heads: HeadStatus[]
  closed: boolean
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
      propertyOwnersTable,
      eq(
        propertyOwnersTable.user_group_id,
        userGroupMembersTable.user_group_id,
      ),
    )
    .where(
      and(
        eq(propertyOwnersTable.property_id, propertyId),
        eq(usersTable.is_head, true),
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

function inclusiveDayCount(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`)
  const e = Date.parse(`${end}T00:00:00Z`)
  return Math.round((e - s) / 86_400_000) + 1
}

function computeTransfers(allocations: GroupAllocation[]): Transfer[] {
  const debtors = allocations
    .filter(a => a.net < 0)
    .map(a => ({ a, remaining: -a.net }))
    .sort((x, y) => y.remaining - x.remaining)
  const creditors = allocations
    .filter(a => a.net > 0)
    .map(a => ({ a, remaining: a.net }))
    .sort((x, y) => y.remaining - x.remaining)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const amount = Math.min(d.remaining, c.remaining)
    if (amount > 0) {
      transfers.push({
        from_group_id: d.a.group_id,
        from_group_name: d.a.group_name,
        to_group_id: c.a.group_id,
        to_group_name: c.a.group_name,
        amount,
      })
    }
    d.remaining -= amount
    c.remaining -= amount
    if (d.remaining === 0) i++
    if (c.remaining === 0) j++
  }
  return transfers
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
  if (settlement.split_policy !== "occupancy_days") {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: `preview not implemented for policy: ${settlement.split_policy}`,
    })
  }
  if (settlement.property_id == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "settlement is not linked to a property",
    })
  }
  const propertyId = settlement.property_id

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
        eq(userGroupsTable.is_main, true),
      ),
    )
  if (mainGroups.length === 0) {
    return {
      policy: "occupancy_days",
      inputs: { total_reimbursed: 0, total_booking_days: 0 },
      groups: [],
      transfers: [],
      heads: [],
      closed: settlement.phase === "closed",
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

  const reimbursedRows = await db
    .select({
      amount: expensesTable.amount,
      reimbursed_by_id: expensesTable.reimbursed_by_id,
    })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.settlement_id, settlementId),
        eq(expensesTable.status, "reimbursed"),
      ),
    )

  const paidByGroup = new Map<number, number>()
  let totalReimbursed = 0
  for (const e of reimbursedRows) {
    totalReimbursed += e.amount
    if (e.reimbursed_by_id == null) continue
    const groupId = userToGroup.get(e.reimbursed_by_id)
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
  if (drift !== 0 && allocations.length > 0) {
    let largest = allocations[0]
    for (const a of allocations) {
      if (a.booking_days > largest.booking_days) largest = a
    }
    largest.total_share += drift
    largest.net = largest.total_paid - largest.total_share
  }

  const headsRows = await listSettlementHeads(db, propertyId)
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
  const heads: HeadStatus[] = headsRows.map(h => {
    const at = acceptanceByHead.get(h.user_id)
    return {
      user_id: h.user_id,
      user_name: h.user_name,
      accepted: at != null,
      accepted_at: at != null ? at.toISOString() : null,
    }
  })

  return {
    policy: "occupancy_days",
    inputs: {
      total_reimbursed: totalReimbursed,
      total_booking_days: totalDays,
    },
    groups: allocations,
    transfers: computeTransfers(allocations),
    heads,
    closed: settlement.phase === "closed",
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
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(settlementsTable)
      .orderBy(asc(settlementsTable.year))
  }),

  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
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
    }),

  create: protectedProcedure
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
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(settlementsTable)
        .set({
          ...rest,
          closed_at: rest.status === "closed" ? new Date() : null,
        })
        .where(eq(settlementsTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(settlementsTable)
        .where(eq(settlementsTable.id, input.id))
        .returning()
      return deleted
    }),

  previewSplit: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return computePreviewSplit(ctx.db, input.id)
    }),

  acceptSplit: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.is_head) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can accept the split",
        })
      }

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

  getBookingAdjustments: protectedProcedure
    .input(z.object({ settlementId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
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
      await assertCanEditBookingAdjustments(
        ctx.db,
        input.settlementId,
        ctx.user.id,
        ctx.user.is_head,
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
      await assertCanEditBookingAdjustments(
        ctx.db,
        input.settlementId,
        ctx.user.id,
        ctx.user.is_head,
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
      const canMarkAnyPaid = ctx.user.is_head

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
        closed_at: settlement.closed_at,
        split_policy: settlement.split_policy,
        split_policy_id: settlement.split_policy_id,
        split_policy_name: settlement.split_policy_name,
        groups,
        transfers: transfers.map(t => ({
          ...t,
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
      if (!ctx.user.is_head) {
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
        return existing
      }
      const [updated] = await ctx.db
        .update(settlementTransfersTable)
        .set({ status: "paid", paid_at: new Date() })
        .where(eq(settlementTransfersTable.id, input.transferId))
        .returning()
      return updated
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
      if (!ctx.user.is_head) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can advance settlement phase",
        })
      }
      const expectedNext = NEXT_PHASE[input.from]
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
      return updated
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
      if (!ctx.user.is_head) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can regress settlement phase",
        })
      }
      const expectedPrev = PREV_PHASE[input.from]
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
      return updated
    }),
})
