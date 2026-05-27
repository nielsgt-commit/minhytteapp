import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { structuresTable, roomTable } from "../../db/schema/property.schema.ts"
import { protectedProcedure, router } from "../init.ts"

const roomFields = {
  name: z.string().min(1, { error: "name is required" }),
  structure_id: z.number().int().positive(),
  beds_sm: z.number().int().nonnegative(),
  beds_lg: z.number().int().nonnegative(),
  beds_double: z.number().int().nonnegative(),
  beds_kid: z.number().int().nonnegative(),
  mattresses: z.number().int().nonnegative(),
  travel_cot: z.number().int().nonnegative(),
}

const createInput = z.object(roomFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...roomFields,
})

export const roomRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: roomTable.id,
          name: roomTable.name,
          structure_id: roomTable.structure_id,
          structure_name: structuresTable.name,
          beds_sm: roomTable.beds_sm,
          beds_lg: roomTable.beds_lg,
          beds_double: roomTable.beds_double,
          beds_kid: roomTable.beds_kid,
          mattresses: roomTable.mattresses,
          travel_cot: roomTable.travel_cot,
        })
        .from(roomTable)
        .innerJoin(
          structuresTable,
          eq(structuresTable.id, roomTable.structure_id),
        )
        .where(eq(structuresTable.property_id, input.property_id))
        .orderBy(asc(roomTable.id))
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(roomTable).values(input).returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(roomTable)
        .set(rest)
        .where(eq(roomTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(roomTable)
        .where(eq(roomTable.id, input.id))
        .returning()
      return deleted
    }),
})
