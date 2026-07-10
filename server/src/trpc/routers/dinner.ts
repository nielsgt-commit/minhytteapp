import { and, eq, gte, lte } from "drizzle-orm"
import { z } from "zod"
import { dinnerResponsiblesTable } from "../../db/schema/dinner.schema.ts"
import { plainDateToDbString, zPlainDate } from "../../shared/temporal.ts"
import { wireMap } from "../util/wire.ts"
import { propertyAdminProcedure, router } from "../init.ts"
import { assertUserIsPropertyMember } from "../util/propertyAccess.ts"

// Wire mapping: date ("YYYY-MM-DD") → Temporal.PlainDate, created_at → Instant.
const toWireDinner = wireMap({
  date: "plainDate",
  created_at: "instant",
})

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
      return rows.map(r => toWireDinner(r))
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
