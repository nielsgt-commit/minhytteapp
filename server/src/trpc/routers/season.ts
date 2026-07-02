import { TRPCError } from "@trpc/server"
import { and, asc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { propertySeasonsTable } from "../../db/schema/property.schema.ts"
import { isValidMonthDay, normalizeWeeks } from "../../shared/season.ts"
import { type Temporal, instantFromDateOrNull } from "../../shared/temporal.ts"
import {
  propertyAdminProcedure,
  propertyHeadOrAdminProcedure,
  router,
} from "../init.ts"

// Wire mapping: archived_at (nullable timestamp) → Temporal.Instant | null.
function toWireSeason<T extends { archived_at: Date | null }>(
  s: T,
): Omit<T, "archived_at"> & { archived_at: Temporal.Instant | null } {
  return { ...s, archived_at: instantFromDateOrNull(s.archived_at) }
}

const seasonFields = z.object({
  name: z.string().trim().min(1).max(64),
  start_month: z.number().int().min(1).max(12),
  start_day: z.number().int().min(1).max(31),
  end_month: z.number().int().min(1).max(12),
  end_day: z.number().int().min(1).max(31),
  // A season may have no priority weeks: it's still a valid chart window,
  // the priority page just has nothing to pick for it.
  priority_weeks: z.array(z.number().int().min(1).max(53)).max(20),
})

// Month-aware day validation on top of the coarse 1–31 zod bound (rejects
// e.g. Feb 30; Feb 29 is allowed and constrained to Feb 28 in common years).
function assertValidRange(input: z.infer<typeof seasonFields>) {
  if (
    !isValidMonthDay(input.start_month, input.start_day) ||
    !isValidMonthDay(input.end_month, input.end_day)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "day does not exist in that month",
    })
  }
}

export const seasonRouter = router({
  list: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: propertySeasonsTable.id,
        name: propertySeasonsTable.name,
        start_month: propertySeasonsTable.start_month,
        start_day: propertySeasonsTable.start_day,
        end_month: propertySeasonsTable.end_month,
        end_day: propertySeasonsTable.end_day,
        priority_weeks: propertySeasonsTable.priority_weeks,
        archived_at: propertySeasonsTable.archived_at,
      })
      .from(propertySeasonsTable)
      .where(
        and(
          eq(propertySeasonsTable.property_id, input.property_id),
          isNull(propertySeasonsTable.archived_at),
        ),
      )
      .orderBy(
        asc(propertySeasonsTable.start_month),
        asc(propertySeasonsTable.start_day),
        asc(propertySeasonsTable.id),
      )
    return rows.map(toWireSeason)
  }),

  create: propertyHeadOrAdminProcedure
    .input(seasonFields)
    .mutation(async ({ ctx, input }) => {
      assertValidRange(input)
      const [created] = await ctx.db
        .insert(propertySeasonsTable)
        .values({
          property_id: input.property_id,
          name: input.name,
          start_month: input.start_month,
          start_day: input.start_day,
          end_month: input.end_month,
          end_day: input.end_day,
          priority_weeks: normalizeWeeks(input.priority_weeks),
        })
        .returning()
      return toWireSeason(created)
    }),

  update: propertyHeadOrAdminProcedure
    .input(seasonFields.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertValidRange(input)
      const existing = (
        await ctx.db
          .select({
            property_id: propertySeasonsTable.property_id,
            archived_at: propertySeasonsTable.archived_at,
          })
          .from(propertySeasonsTable)
          .where(eq(propertySeasonsTable.id, input.id))
      ).at(0)
      if (existing?.property_id !== input.property_id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (existing.archived_at != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cannot edit an archived season",
        })
      }
      const [updated] = await ctx.db
        .update(propertySeasonsTable)
        .set({
          name: input.name,
          start_month: input.start_month,
          start_day: input.start_day,
          end_month: input.end_month,
          end_day: input.end_day,
          priority_weeks: normalizeWeeks(input.priority_weeks),
          updated_at: new Date(),
        })
        .where(eq(propertySeasonsTable.id, input.id))
        .returning()
      return toWireSeason(updated)
    }),

  archive: propertyHeadOrAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({ property_id: propertySeasonsTable.property_id })
          .from(propertySeasonsTable)
          .where(eq(propertySeasonsTable.id, input.id))
      ).at(0)
      if (existing?.property_id !== input.property_id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      const [archived] = await ctx.db
        .update(propertySeasonsTable)
        .set({ archived_at: new Date(), updated_at: new Date() })
        .where(eq(propertySeasonsTable.id, input.id))
        .returning()
      return toWireSeason(archived)
    }),
})
