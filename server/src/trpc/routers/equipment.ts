import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { equipmentTable } from "../../db/schema/maintenance.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const equipmentFields = {
  name: z.string().min(1, { error: "name is required" }).max(255),
  property_id: z.number().int().positive(),
  brand: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  category: z.string().max(32).optional(),
  notes: z.string().max(255).optional(),
  acquired_year: z.number().int().min(1500).max(2100).nullable().optional(),
}

const createInput = z.object(equipmentFields)
const updateInput = z.object({
  id: z.number().int().positive(),
  ...equipmentFields,
})

export const equipmentRouter = router({
  listForProperty: publicProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(equipmentTable)
        .where(eq(equipmentTable.property_id, input.property_id))
        .orderBy(asc(equipmentTable.id))
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(equipmentTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(equipmentTable)
        .set(rest)
        .where(eq(equipmentTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(equipmentTable)
        .where(eq(equipmentTable.id, input.id))
        .returning()
      return deleted
    }),
})
