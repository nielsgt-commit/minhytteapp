import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { usersTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const userFields = {
  name: z.string().min(1, { error: "name is required" }),
  email: z.email(),
  is_admin: z.boolean().optional(),
  is_child: z.boolean().optional(),
}

const createInput = z.object(userFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...userFields,
})

export const userRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(usersTable)
      .orderBy(asc(usersTable.id))
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(usersTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(usersTable)
        .set(rest)
        .where(eq(usersTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(usersTable)
        .where(eq(usersTable.id, input.id))
        .returning()
      return deleted
    }),
})
