import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import {
  buildingsTable,
  propertyTable,
} from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const buildingFields = {
  name: z.string().min(1, { error: "name is required" }),
  property_id: z.number().int().positive(),
}

const createInput = z.object(buildingFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...buildingFields,
})

export const buildingRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: buildingsTable.id,
        name: buildingsTable.name,
        property_id: buildingsTable.property_id,
        property_name: propertyTable.name,
      })
      .from(buildingsTable)
      .leftJoin(
        propertyTable,
        eq(propertyTable.id, buildingsTable.property_id),
      )
      .orderBy(asc(buildingsTable.id))
    return rows
  }),

  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: buildingsTable.id,
          name: buildingsTable.name,
          property_id: buildingsTable.property_id,
          property_name: propertyTable.name,
        })
        .from(buildingsTable)
        .leftJoin(
          propertyTable,
          eq(propertyTable.id, buildingsTable.property_id),
        )
        .where(eq(buildingsTable.property_id, input.property_id))
        .orderBy(asc(buildingsTable.id))
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(buildingsTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(buildingsTable)
        .set(rest)
        .where(eq(buildingsTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(buildingsTable)
        .where(eq(buildingsTable.id, input.id))
        .returning()
      return deleted
    }),
})
