import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { placeTable } from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const placeFields = {
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().min(1, { error: "description is required" }).max(255),
  property_id: z.number().int().positive(),
}

const createInput = z.object(placeFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...placeFields,
})

export const placeRouter = router({
  listForProperty: publicProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(placeTable)
        .where(eq(placeTable.property_id, input.property_id))
        .orderBy(asc(placeTable.id))
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(placeTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(placeTable)
        .set(rest)
        .where(eq(placeTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(placeTable)
        .where(eq(placeTable.id, input.id))
        .returning()
      return deleted
    }),
})