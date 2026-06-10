import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import { z } from "zod"
import { maintenanceTable } from "../../db/schema/maintenance.schema.ts"
import {
  propertyOwnersTable,
  propertyPriorityWeeksTable,
} from "../../db/schema/property.schema.ts"
import {
  allowedEmailsTable,
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
  const owningGroupIds = owningGroupRows.map(r => r.id)

  const linkedGroupRows = await ctx.db
    .select({ id: userGroupsTable.id })
    .from(userGroupsTable)
    .where(eq(userGroupsTable.property_id, property_id))
  const linkedGroupIds = linkedGroupRows.map(r => r.id)

  const propertyGroupIds = Array.from(
    new Set<number>([...owningGroupIds, ...linkedGroupIds]),
  )

  const peopleSet = new Set<number>([calling_user_id])
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

// The set of user ids considered "part of" a property: people in its
// owning/linked groups, plus everyone in groups those people belong to, plus
// the calling user. This is the same population `user.listForProperty`
// exposes, and the authorization boundary for editing a property's users.
export async function userIdsForProperty(
  ctx: Context,
  property_id: number,
  calling_user_id: number,
): Promise<Set<number>> {
  const { relevantGroupIds, peopleSet } = await relevantGroupIdsForProperty(
    ctx,
    property_id,
    calling_user_id,
  )
  const ids = new Set<number>(peopleSet)
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
  ids.add(calling_user_id)
  return ids
}

const userGroupFields = {
  name: z.string().min(1, { error: "name is required" }),
  is_family: z.boolean().optional(),
}

async function fetchGroupsWithMembers(ctx: Context, groupIds: number[]) {
  if (groupIds.length === 0) return []
  const groups = await ctx.db
    .select({
      id: userGroupsTable.id,
      name: userGroupsTable.name,
      is_family: userGroupsTable.is_family,
    })
    .from(userGroupsTable)
    .where(inArray(userGroupsTable.id, groupIds))
    .orderBy(asc(userGroupsTable.id))

  const members = await ctx.db
    .select({
      user_group_id: userGroupMembersTable.user_group_id,
      user_id: userGroupMembersTable.user_id,
      user_name: usersTable.name,
      is_head: userGroupMembersTable.is_head,
    })
    .from(userGroupMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, userGroupMembersTable.user_id))
    .where(inArray(userGroupMembersTable.user_group_id, groupIds))
    .orderBy(asc(usersTable.id))

  const byGroup = new Map<
    number,
    { user_id: number; user_name: string; is_head: boolean }[]
  >()
  for (const m of members) {
    const list = byGroup.get(m.user_group_id) ?? []
    list.push({
      user_id: m.user_id,
      user_name: m.user_name,
      is_head: m.is_head,
    })
    byGroup.set(m.user_group_id, list)
  }

  return groups.map(g => ({
    ...g,
    members: byGroup.get(g.id) ?? [],
  }))
}

// Group ids a non-admin user is allowed to see: the relevant groups of every
// property they belong to (property membership mirrors property.mine). Used to
// scope listWithMembers so a user can't read every group/member in the system.
async function visibleGroupIdsForUser(
  ctx: Context,
  userId: number,
): Promise<Set<number>> {
  const viaOwners = await ctx.db
    .selectDistinct({ id: propertyOwnersTable.property_id })
    .from(propertyOwnersTable)
    .innerJoin(
      userGroupMembersTable,
      eq(
        userGroupMembersTable.user_group_id,
        propertyOwnersTable.user_group_id,
      ),
    )
    .where(eq(userGroupMembersTable.user_id, userId))

  const viaGroupLink = await ctx.db
    .selectDistinct({ id: userGroupsTable.property_id })
    .from(userGroupsTable)
    .innerJoin(
      userGroupMembersTable,
      eq(userGroupMembersTable.user_group_id, userGroupsTable.id),
    )
    .where(
      and(
        eq(userGroupMembersTable.user_id, userId),
        isNotNull(userGroupsTable.property_id),
      ),
    )

  const propertyIds = new Set<number>()
  for (const r of viaOwners) if (r.id != null) propertyIds.add(r.id)
  for (const r of viaGroupLink) if (r.id != null) propertyIds.add(r.id)

  const groupIds = new Set<number>()
  for (const propertyId of propertyIds) {
    const { relevantGroupIds } = await relevantGroupIdsForProperty(
      ctx,
      propertyId,
      userId,
    )
    for (const gid of relevantGroupIds) groupIds.add(gid)
  }
  return groupIds
}

// A property's groups may only be mutated through that same property.
// propertyAdminProcedure proves the caller is a member of input.property_id,
// but NOT that the target group belongs to it — without this a member of
// property A could edit/delete a group owned by property B by passing their
// own property_id. Orphaned groups (NULL property_id, legacy) pass through so
// update() can heal them. Returns the group's current property_id.
export async function assertGroupBelongsToProperty(
  ctx: Context,
  groupId: number,
  propertyId: number,
): Promise<number | null> {
  const existing = (
    await ctx.db
      .select({ property_id: userGroupsTable.property_id })
      .from(userGroupsTable)
      .where(eq(userGroupsTable.id, groupId))
      .limit(1)
  ).at(0)
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "group not found" })
  }
  if (existing.property_id != null && existing.property_id !== propertyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "group does not belong to this property",
    })
  }
  return existing.property_id
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
    // Non-admins may only see groups belonging to properties they are a member
    // of. Admins keep the global view used by the admin ownership screens.
    let visibleGroupIds: number[] | null = null
    if (!ctx.user.is_admin) {
      const ids = await visibleGroupIdsForUser(ctx, ctx.user.id)
      if (ids.size === 0) return []
      visibleGroupIds = Array.from(ids)
    }

    const groups = await ctx.db
      .select()
      .from(userGroupsTable)
      .where(
        visibleGroupIds
          ? inArray(userGroupsTable.id, visibleGroupIds)
          : undefined,
      )
      .orderBy(asc(userGroupsTable.id))

    const members = await ctx.db
      .select({
        user_group_id: userGroupMembersTable.user_group_id,
        user_id: userGroupMembersTable.user_id,
        user_name: usersTable.name,
      })
      .from(userGroupMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, userGroupMembersTable.user_id))
      .where(
        visibleGroupIds
          ? inArray(userGroupMembersTable.user_group_id, visibleGroupIds)
          : undefined,
      )
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
      const { property_id, ...rest } = input
      const [created] = await ctx.db
        .insert(userGroupsTable)
        .values({ ...rest, property_id })
        .returning()
      await ctx.db
        .insert(userGroupMembersTable)
        .values({ user_group_id: created.id, user_id: ctx.user.id })
      return created
    }),

  update: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive(), ...userGroupFields }))
    .mutation(async ({ ctx, input }) => {
      // property_id comes from propertyAdminProcedure (the property in context).
      // We never *move* a group between properties here, but we do heal an
      // orphaned group: if it was created with a NULL link (legacy / older
      // code path), linking it now restores visibility for all its members
      // instead of forcing an admin to delete + recreate the group. A group
      // already linked to a property is left untouched.
      const { id, property_id, ...rest } = input
      const existingPropertyId = await assertGroupBelongsToProperty(
        ctx,
        id,
        property_id,
      )
      const [updated] = await ctx.db
        .update(userGroupsTable)
        .set(existingPropertyId == null ? { ...rest, property_id } : rest)
        .where(eq(userGroupsTable.id, id))
        .returning()
      return updated
    }),

  delete: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertGroupBelongsToProperty(ctx, input.id, input.property_id)
      return ctx.db.transaction(async tx => {
        // None of the tables referencing user_groups declare an ON DELETE
        // action, so they default to RESTRICT — every referencing row must be
        // cleared in-transaction or the delete aborts. user_group_members
        // alone makes this fire for *every* group, since create() auto-adds the
        // creator as a member (an "empty" group only exists after a manual
        // purge). Owner/priority-week rows make owning groups fail too.

        // A plain FK SET NULL would leave due_kind='priority_week' with a null
        // group, violating the maintenance_due_shape CHECK and aborting the
        // delete. Reset referencing rows to 'not_decided' first.
        await tx
          .update(maintenanceTable)
          .set({ due_kind: "not_decided", due_priority_group_id: null })
          .where(eq(maintenanceTable.due_priority_group_id, input.id))
        await tx
          .delete(userGroupMembersTable)
          .where(eq(userGroupMembersTable.user_group_id, input.id))
        await tx
          .delete(propertyOwnersTable)
          .where(eq(propertyOwnersTable.user_group_id, input.id))
        await tx
          .delete(propertyPriorityWeeksTable)
          .where(eq(propertyPriorityWeeksTable.user_group_id, input.id))
        // allowed_emails.user_group_id is nullable — just detach the invite so
        // the pending invitee survives the group deletion (re-assignable later).
        await tx
          .update(allowedEmailsTable)
          .set({ user_group_id: null })
          .where(eq(allowedEmailsTable.user_group_id, input.id))
        const [deleted] = await tx
          .delete(userGroupsTable)
          .where(eq(userGroupsTable.id, input.id))
          .returning()
        return deleted
      })
    }),

  addMember: propertyAdminProcedure
    .input(
      z.object({
        user_group_id: z.number().int().positive(),
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertGroupBelongsToProperty(
        ctx,
        input.user_group_id,
        input.property_id,
      )
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
      await assertGroupBelongsToProperty(
        ctx,
        input.user_group_id,
        input.property_id,
      )
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
