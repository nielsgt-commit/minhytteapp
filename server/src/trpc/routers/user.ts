import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { propertyOwnersTable } from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import {
  authenticatedProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../init.ts"

const userFields = {
  name: z.string().min(1, { error: "name is required" }),
  email: z.email(),
  is_admin: z.boolean().optional(),
  is_head: z.boolean().optional(),
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

  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const directOwnerIds = await ctx.db
        .selectDistinct({ user_id: propertyOwnersTable.user_id })
        .from(propertyOwnersTable)
        .where(eq(propertyOwnersTable.property_id, input.property_id))

      const groupMemberIds = await ctx.db
        .selectDistinct({ user_id: userGroupMembersTable.user_id })
        .from(userGroupMembersTable)
        .innerJoin(
          propertyOwnersTable,
          eq(
            propertyOwnersTable.user_group_id,
            userGroupMembersTable.user_group_id,
          ),
        )
        .where(eq(propertyOwnersTable.property_id, input.property_id))

      const ids = new Set<number>()
      for (const row of directOwnerIds) {
        if (row.user_id != null) ids.add(row.user_id)
      }
      for (const row of groupMemberIds) {
        ids.add(row.user_id)
      }
      if (ids.size === 0) return []

      return ctx.db
        .select()
        .from(usersTable)
        .where(inArray(usersTable.id, Array.from(ids)))
        .orderBy(asc(usersTable.id))
    }),

  me: authenticatedProcedure.query(({ ctx }) => ctx.user),

  bootstrap: authenticatedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user) return ctx.user

    const { sub, name, email } = ctx.claims
    const isDev = process.env.NODE_ENV !== "production"
    await ctx.db.transaction(async tx => {
      const existing = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .limit(1)
      const isFirst = isDev && existing.length === 0
      await tx
        .insert(usersTable)
        .values({
          name: name ?? sub,
          email: email ?? `${sub}@oauth.local`,
          oauth_sub: sub,
          is_admin: isFirst,
        })
        .onConflictDoNothing({ target: usersTable.oauth_sub })
    })

    const created = (
      await ctx.db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          is_admin: usersTable.is_admin,
          is_head: usersTable.is_head,
          settlement_progress: usersTable.settlement_progress,
        })
        .from(usersTable)
        .where(eq(usersTable.oauth_sub, sub))
        .limit(1)
    ).at(0)

    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "failed to provision user",
      })
    }
    return created
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

  updateMyName: protectedProcedure
    .input(z.object({ name: z.string().min(1, { error: "name is required" }) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ name: input.name })
        .where(eq(usersTable.id, ctx.user.id))
        .returning()
      return updated
    }),

  updateMyIsHead: protectedProcedure
    .input(z.object({ is_head: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ is_head: input.is_head })
        .where(eq(usersTable.id, ctx.user.id))
        .returning()
      return updated
    }),

  updateMySettlementProgress: protectedProcedure
    .input(
      z.object({
        settlement_progress: z.enum(["in_progress", "all_done"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.is_head) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only heads can update settlement progress",
        })
      }
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ settlement_progress: input.settlement_progress })
        .where(eq(usersTable.id, ctx.user.id))
        .returning()
      return updated
    }),

  listMyChildren: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.parent_user_id, ctx.user.id))
      .orderBy(asc(usersTable.id))
  }),

  createChild: protectedProcedure
    .input(z.object({ name: z.string().min(1, { error: "name is required" }) }))
    .mutation(async ({ ctx, input }) => {
      const email = `child-${String(ctx.user.id)}-${String(Date.now())}@example.local`
      const [created] = await ctx.db
        .insert(usersTable)
        .values({
          name: input.name,
          email,
          is_admin: false,
          is_child: true,
          parent_user_id: ctx.user.id,
        })
        .returning()
      return created
    }),

  updateChild: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1, { error: "name is required" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ name: input.name })
        .where(
          and(
            eq(usersTable.id, input.id),
            eq(usersTable.parent_user_id, ctx.user.id),
          ),
        )
        .returning()
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      return updated
    }),

  removeChild: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(usersTable)
        .where(
          and(
            eq(usersTable.id, input.id),
            eq(usersTable.parent_user_id, ctx.user.id),
          ),
        )
        .returning()
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      return deleted
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
