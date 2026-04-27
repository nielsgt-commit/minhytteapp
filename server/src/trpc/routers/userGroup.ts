import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { propertyOwnersTable } from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../init.ts"

const userGroupFields = {
  name: z.string().min(1, { error: "name is required" }),
  is_main: z.boolean().optional(),
}

export const userGroupRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(userGroupsTable)
      .orderBy(asc(userGroupsTable.id))
  }),

  listWithMembersForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db
        .selectDistinct({
          id: userGroupsTable.id,
          name: userGroupsTable.name,
          is_main: userGroupsTable.is_main,
        })
        .from(userGroupsTable)
        .innerJoin(
          propertyOwnersTable,
          eq(propertyOwnersTable.user_group_id, userGroupsTable.id),
        )
        .where(eq(propertyOwnersTable.property_id, input.property_id))
        .orderBy(asc(userGroupsTable.id))

      if (groups.length === 0) return []

      const groupIds = groups.map(g => g.id)
      const members = await ctx.db
        .select({
          user_group_id: userGroupMembersTable.user_group_id,
          user_id: userGroupMembersTable.user_id,
          user_name: usersTable.name,
        })
        .from(userGroupMembersTable)
        .innerJoin(usersTable, eq(usersTable.id, userGroupMembersTable.user_id))
        .where(inArray(userGroupMembersTable.user_group_id, groupIds))
        .orderBy(asc(usersTable.id))

      const byGroup = new Map<
        number,
        { user_id: number; user_name: string }[]
      >()
      for (const m of members) {
        const list = byGroup.get(m.user_group_id) ?? []
        list.push({ user_id: m.user_id, user_name: m.user_name })
        byGroup.set(m.user_group_id, list)
      }

      return groups.map(g => ({
        ...g,
        members: byGroup.get(g.id) ?? [],
      }))
    }),

  listWithMembers: publicProcedure.query(async ({ ctx }) => {
    const groups = await ctx.db
      .select()
      .from(userGroupsTable)
      .orderBy(asc(userGroupsTable.id))

    const members = await ctx.db
      .select({
        user_group_id: userGroupMembersTable.user_group_id,
        user_id: userGroupMembersTable.user_id,
        user_name: usersTable.name,
      })
      .from(userGroupMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, userGroupMembersTable.user_id))
      .orderBy(asc(usersTable.id))

    const byGroup = new Map<
      number,
      { user_id: number; user_name: string }[]
    >()
    for (const m of members) {
      const list = byGroup.get(m.user_group_id) ?? []
      list.push({ user_id: m.user_id, user_name: m.user_name })
      byGroup.set(m.user_group_id, list)
    }

    return groups.map(g => ({
      ...g,
      members: byGroup.get(g.id) ?? [],
    }))
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

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(userGroupsTable)
        .where(eq(userGroupsTable.id, input.id))
        .returning()
      return deleted
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        user_group_id: z.number().int().positive(),
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(userGroupMembersTable)
        .values(input)
        .returning()
      return created
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        user_group_id: z.number().int().positive(),
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(userGroupMembersTable)
        .where(
          and(
            eq(userGroupMembersTable.user_group_id, input.user_group_id),
            eq(userGroupMembersTable.user_id, input.user_id),
          ),
        )
        .returning()
      return deleted
    }),
})
