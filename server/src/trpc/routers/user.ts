import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { propertyOwnersTable } from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import {
  adminProcedure,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import { relevantGroupIdsForProperty } from "./userGroup.ts"

const birthdayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "expected YYYY-MM-DD" })

const userFields = {
  name: z.string().min(1, { error: "name is required" }),
  email: z.email(),
  is_admin: z.boolean().optional(),
  is_head: z.boolean().optional(),
  is_child: z.boolean().optional(),
  birthday: birthdayString.nullable().optional(),
}

const createInput = z.object(userFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...userFields,
})

export const userRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(usersTable)
      .orderBy(asc(usersTable.id))
  }),

  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const { relevantGroupIds, peopleSet } = await relevantGroupIdsForProperty(
      ctx,
      input.property_id,
      ctx.user.id,
    )

    const ids = new Set<number>(peopleSet)
    ids.delete(ctx.user.id)
    const directOwnerRows = await ctx.db
      .select({ user_id: propertyOwnersTable.user_id })
      .from(propertyOwnersTable)
      .where(eq(propertyOwnersTable.property_id, input.property_id))
    for (const row of directOwnerRows) {
      if (row.user_id != null) ids.add(row.user_id)
    }
    if (relevantGroupIds.size > 0) {
      const memberRows = await ctx.db
        .selectDistinct({ user_id: userGroupMembersTable.user_id })
        .from(userGroupMembersTable)
        .where(
          inArray(
            userGroupMembersTable.user_group_id,
            Array.from(relevantGroupIds),
          ),
        )
      for (const row of memberRows) ids.add(row.user_id)
    }
    ids.add(ctx.user.id)

    if (ids.size === 0) return []
    return ctx.db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, Array.from(ids)))
      .orderBy(asc(usersTable.id))
  }),

  me: protectedProcedure.query(({ ctx }) => ctx.user),

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

  updateMyBirthday: protectedProcedure
    .input(z.object({ birthday: birthdayString.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ birthday: input.birthday })
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

  update: adminProcedure
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

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(usersTable)
        .where(eq(usersTable.id, input.id))
        .returning()
      return deleted
    }),
})
