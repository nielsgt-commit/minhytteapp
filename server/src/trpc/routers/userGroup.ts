import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import { z } from "zod"
import { propertyOwnersTable } from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import type { Context } from "../context.ts"
import { propertyAdminProcedure, protectedProcedure, router } from "../init.ts"

export async function relevantGroupIdsForProperty(
  ctx: Context,
  property_id: number,
  calling_user_id: number,
) {
  const owningGroupRows = await ctx.db
    .select({ id: propertyOwnersTable.user_group_id })
    .from(propertyOwnersTable)
    .where(
      and(
        eq(propertyOwnersTable.property_id, property_id),
        isNotNull(propertyOwnersTable.user_group_id),
      ),
    )
  const owningGroupIds = owningGroupRows
    .map(r => r.id)
    .filter((id): id is number => id != null)

  const linkedGroupRows = await ctx.db
    .select({ id: userGroupsTable.id })
    .from(userGroupsTable)
    .where(eq(userGroupsTable.property_id, property_id))
  const linkedGroupIds = linkedGroupRows.map(r => r.id)

  const propertyGroupIds = Array.from(
    new Set<number>([...owningGroupIds, ...linkedGroupIds]),
  )

  const directOwnerRows = await ctx.db
    .select({ user_id: propertyOwnersTable.user_id })
    .from(propertyOwnersTable)
    .where(
      and(
        eq(propertyOwnersTable.property_id, property_id),
        isNotNull(propertyOwnersTable.user_id),
      ),
    )

  const peopleSet = new Set<number>([calling_user_id])
  for (const r of directOwnerRows) {
    if (r.user_id != null) peopleSet.add(r.user_id)
  }
  if (propertyGroupIds.length > 0) {
    const owningMembers = await ctx.db
      .select({ user_id: userGroupMembersTable.user_id })
      .from(userGroupMembersTable)
      .where(inArray(userGroupMembersTable.user_group_id, propertyGroupIds))
    for (const r of owningMembers) peopleSet.add(r.user_id)
  }

  const relevantIds = new Set<number>(propertyGroupIds)
  if (peopleSet.size > 0) {
    const groupsByMember = await ctx.db
      .selectDistinct({ id: userGroupMembersTable.user_group_id })
      .from(userGroupMembersTable)
      .where(inArray(userGroupMembersTable.user_id, Array.from(peopleSet)))
    for (const r of groupsByMember) relevantIds.add(r.id)
  }

  return { relevantGroupIds: relevantIds, peopleSet }
}

const userGroupFields = {
  name: z.string().min(1, { error: "name is required" }),
  is_main: z.boolean().optional(),
}

async function fetchGroupsWithMembers(ctx: Context, groupIds: number[]) {
  if (groupIds.length === 0) return []
  const groups = await ctx.db
    .select({
      id: userGroupsTable.id,
      name: userGroupsTable.name,
      is_main: userGroupsTable.is_main,
    })
    .from(userGroupsTable)
    .where(inArray(userGroupsTable.id, groupIds))
    .orderBy(asc(userGroupsTable.id))

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

  const byGroup = new Map<number, { user_id: number; user_name: string }[]>()
  for (const m of members) {
    const list = byGroup.get(m.user_group_id) ?? []
    list.push({ user_id: m.user_id, user_name: m.user_name })
    byGroup.set(m.user_group_id, list)
  }

  return groups.map(g => ({
    ...g,
    members: byGroup.get(g.id) ?? [],
  }))
}

export const userGroupRouter = router({
  listWithMembersForProperty: propertyAdminProcedure.query(
    async ({ ctx, input }) => {
      const { relevantGroupIds } = await relevantGroupIdsForProperty(
        ctx,
        input.property_id,
        ctx.user.id,
      )
      return fetchGroupsWithMembers(ctx, Array.from(relevantGroupIds))
    },
  ),

  listWithMembers: protectedProcedure.query(async ({ ctx }) => {
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

    const byGroup = new Map<number, { user_id: number; user_name: string }[]>()
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

  create: propertyAdminProcedure
    .input(z.object(userGroupFields))
    .mutation(async ({ ctx, input }) => {
      const { property_id: _propId, ...rest } = input
      const [created] = await ctx.db
        .insert(userGroupsTable)
        .values(rest)
        .returning()
      await ctx.db
        .insert(userGroupMembersTable)
        .values({ user_group_id: created.id, user_id: ctx.user.id })
      return created
    }),

  update: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive(), ...userGroupFields }))
    .mutation(async ({ ctx, input }) => {
      const { id, property_id: _propId, ...rest } = input
      const [updated] = await ctx.db
        .update(userGroupsTable)
        .set(rest)
        .where(eq(userGroupsTable.id, id))
        .returning()
      return updated
    }),

  delete: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(userGroupsTable)
        .where(eq(userGroupsTable.id, input.id))
        .returning()
      return deleted
    }),

  addMember: propertyAdminProcedure
    .input(
      z.object({
        user_group_id: z.number().int().positive(),
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(userGroupMembersTable)
        .values({
          user_group_id: input.user_group_id,
          user_id: input.user_id,
        })
        .returning()
      return created
    }),

  removeMember: propertyAdminProcedure
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
