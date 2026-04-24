import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { userGroupsTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const userGroupFields = {
  name: z.string().min(1, { error: "name is required" }),
}

export const userGroupRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(userGroupsTable)
      .orderBy(asc(userGroupsTable.id))
  }),

  create: protectedProcedure
    .input(z.object(userGroupFields))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(userGroupsTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), ...userGroupFields }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(userGroupsTable)
        .set(rest)
        .where(eq(userGroupsTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(userGroupsTable)
        .where(eq(userGroupsTable.id, input.id))
        .returning()
      return deleted
    }),
})