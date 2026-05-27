import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import {
  propertyTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import { protectedProcedure, router } from "../init.ts"

const structureFields = {
  name: z.string().min(1, { error: "name is required" }),
  property_id: z.number().int().positive(),
  category: z.enum(["habitable", "non_habitable"]).default("habitable"),
  built_year: z.number().int().min(1500).max(2100).nullable().optional(),
}

const createInput = z.object(structureFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...structureFields,
})

export const structureRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: structuresTable.id,
          name: structuresTable.name,
          property_id: structuresTable.property_id,
          property_name: propertyTable.name,
          category: structuresTable.category,
          built_year: structuresTable.built_year,
        })
        .from(structuresTable)
        .leftJoin(
          propertyTable,
          eq(propertyTable.id, structuresTable.property_id),
        )
        .where(eq(structuresTable.property_id, input.property_id))
        .orderBy(asc(structuresTable.id))
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(structuresTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(structuresTable)
        .set(rest)
        .where(eq(structuresTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(structuresTable)
        .where(eq(structuresTable.id, input.id))
        .returning()
      return deleted
    }),
})
