import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { propertyTable } from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const propertyFields = {
  name: z.string().min(1, { error: "name is required" }),
  address: z.string().min(1, { error: "address is required" }),
  owner_group_id: z.number().int().positive().nullable().optional(),
  link: z.string().max(255).nullable().optional(),
}

const createInput = z.object(propertyFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...propertyFields,
})

export const propertyRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(propertyTable)
      .orderBy(asc(propertyTable.id))
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(propertyTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(propertyTable)
        .set(rest)
        .where(eq(propertyTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(propertyTable)
        .where(eq(propertyTable.id, input.id))
        .returning()
      return deleted
    }),
})
