import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { propertyOwnersTable } from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const ownerFields = {
  property_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  ownership_pct: z
    .union([z.string(), z.number()])
    .transform(v => String(v))
    .refine(
      v => {
        const n = Number(v)
        return Number.isFinite(n) && n >= 0 && n <= 100
      },
      { error: "ownership_pct must be between 0 and 100" },
    ),
}

export const propertyOwnerRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(propertyOwnersTable)
      .orderBy(
        asc(propertyOwnersTable.property_id),
        asc(propertyOwnersTable.user_id),
      )
  }),

  upsert: protectedProcedure
    .input(z.object(ownerFields))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(propertyOwnersTable)
        .values(input)
        .onConflictDoUpdate({
          target: [
            propertyOwnersTable.property_id,
            propertyOwnersTable.user_id,
          ],
          set: { ownership_pct: input.ownership_pct },
        })
        .returning()
      return row
    }),

  delete: protectedProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(propertyOwnersTable)
        .where(
          and(
            eq(propertyOwnersTable.property_id, input.property_id),
            eq(propertyOwnersTable.user_id, input.user_id),
          ),
        )
        .returning()
      return deleted
    }),
})