import { and, eq, gte, lte } from "drizzle-orm"
import { z } from "zod"
import { dinnerResponsiblesTable } from "../../db/schema/dinner.schema.ts"
import {
  type Temporal,
  instantFromDate,
  plainDateFromDb,
  plainDateToDbString,
  zPlainDate,
} from "../../shared/temporal.ts"
import { propertyAdminProcedure, router } from "../init.ts"
import { assertUserIsPropertyMember } from "../util/propertyAccess.ts"

// Wire mapping: date ("YYYY-MM-DD") → Temporal.PlainDate, created_at → Instant.
function toWireDinner<T extends { date: string; created_at: Date }>(
  row: T,
): Omit<T, "date" | "created_at"> & {
  date: Temporal.PlainDate
  created_at: Temporal.Instant
} {
  return {
    ...row,
    date: plainDateFromDb(row.date),
    created_at: instantFromDate(row.created_at),
  }
}

export const dinnerRouter = router({
  listForProperty: propertyAdminProcedure
    .input(
      z.object({
        start: zPlainDate,
        end: zPlainDate,
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(dinnerResponsiblesTable)
        .where(
          and(
            eq(dinnerResponsiblesTable.property_id, input.property_id),
            gte(dinnerResponsiblesTable.date, plainDateToDbString(input.start)),
            lte(dinnerResponsiblesTable.date, plainDateToDbString(input.end)),
          ),
        )
        .orderBy(dinnerResponsiblesTable.date, dinnerResponsiblesTable.id)
      return rows.map(toWireDinner)
    }),

  set: propertyAdminProcedure
    .input(
      z.object({
        date: zPlainDate,
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertUserIsPropertyMember(ctx.db, input.user_id, input.property_id)
      const created = (
        await ctx.db
          .insert(dinnerResponsiblesTable)
          .values({
            property_id: input.property_id,
            user_id: input.user_id,
            date: plainDateToDbString(input.date),
          })
          .onConflictDoNothing()
          .returning()
      ).at(0)
      return created ? toWireDinner(created) : null
    }),

  remove: propertyAdminProcedure
    .input(
      z.object({
        date: zPlainDate,
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(dinnerResponsiblesTable)
        .where(
          and(
            eq(dinnerResponsiblesTable.property_id, input.property_id),
            eq(dinnerResponsiblesTable.date, plainDateToDbString(input.date)),
            eq(dinnerResponsiblesTable.user_id, input.user_id),
          ),
        )
      return { ok: true as const }
    }),
})
