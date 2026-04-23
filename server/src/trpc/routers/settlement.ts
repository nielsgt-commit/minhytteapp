import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { settlementsTable } from "../../db/schema/settlement.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const settlementFields = {
  year: z.number().int(),
  season: z
    .enum(["winter", "spring", "summer", "autumn"])
    .optional(),
  status: z.enum(["open", "closed"]),
  split_policy: z.enum(["shares", "groups_equal", "occupancy_days"]),
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

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(settlementsTable)
        .values({
          ...input,
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
})