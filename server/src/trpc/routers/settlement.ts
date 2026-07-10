import { and, asc, eq } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import {
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
import { instantFromDateOrNull } from "../../shared/temporal.ts"
import { wireMap } from "../util/wire.ts"
import { SETTLEMENT_PHASES } from "../../shared/splitPolicy.ts"
import {
  advanceSettlementPhase,
  assertCanEditBookingAdjustments,
  listSettlementHeads,
  regressSettlementPhase,
} from "../../services/settlementPhase.ts"
import {
  computePreviewSplit,
  persistClosedSplit,
} from "../../services/settlementPreview.ts"
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
const toWireSettlement = wireMap({
  opened_at: "instant",
  closed_at: "instantOrNull",
})

// Wire mapping: settlement transfer paid_at → Temporal.Instant | null.
const toWireTransfer = wireMap({ paid_at: "instantOrNull" })

const phaseEnum = z.enum(SETTLEMENT_PHASES)

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
      return rows.map(r => toWireSettlement(r))
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
        await assertPropertyHead(
          ctx.db,
          ctx.user,
          settlement.property_id,
          "only heads can accept the split",
        )
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
      const closed = await persistClosedSplit(ctx.db, input.id, preview)

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
      await assertPropertyHead(
        ctx.db,
        ctx.user,
        propertyId,
        "only heads can update review progress",
      )

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
      await assertPropertyHead(
        ctx.db,
        ctx.user,
        propertyId,
        "only heads can mark transfers paid",
      )
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
      await assertPropertyHead(
        ctx.db,
        ctx.user,
        propertyId,
        "only heads can advance settlement phase",
      )
      const updated = await advanceSettlementPhase(ctx.db, {
        settlementId: input.id,
        propertyId,
        from: input.from,
        to: input.to,
      })
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
      await assertPropertyHead(
        ctx.db,
        ctx.user,
        propertyId,
        "only heads can regress settlement phase",
      )
      const updated = await regressSettlementPhase(ctx.db, {
        settlementId: input.id,
        from: input.from,
        to: input.to,
      })
      return toWireSettlement(updated)
    }),
})
