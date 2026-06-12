import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { propertyTable } from "../../db/schema/property.schema.ts"
import {
  allowedEmailsTable,
  childParentsTable,
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import {
  adminProcedure,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import type { Context } from "../context.ts"
import {
  type Temporal,
  instantFromDate,
  instantFromDateOrNull,
  plainDateFromDbOrNull,
  plainDateToDbString,
  zPlainDate,
} from "../../shared/temporal.ts"
import { userIdsForProperty, visibleGroupIdsForUser } from "./userGroup.ts"
import { isSyntheticEmail, normalizeEmail } from "../../auth/email.ts"

const userFields = {
  name: z.string().min(1, { error: "name is required" }),
  email: z.email(),
  is_admin: z.boolean().optional(),
  is_child: z.boolean().optional(),
  birthday: zPlainDate.nullable().optional(),
}

// Wire mapping for full users rows: `birthday` is a "YYYY-MM-DD" string
// (date column), the *_at columns are JS Dates — convert to Temporal.
function toWireUser<
  T extends {
    birthday: string | null
    onboarding_dismissed_at: Date | null
    created_at: Date
    updated_at: Date
  },
>(
  u: T,
): Omit<
  T,
  "birthday" | "onboarding_dismissed_at" | "created_at" | "updated_at"
> & {
  birthday: Temporal.PlainDate | null
  onboarding_dismissed_at: Temporal.Instant | null
  created_at: Temporal.Instant
  updated_at: Temporal.Instant
} {
  return {
    ...u,
    birthday: plainDateFromDbOrNull(u.birthday),
    onboarding_dismissed_at: instantFromDateOrNull(u.onboarding_dismissed_at),
    created_at: instantFromDate(u.created_at),
    updated_at: instantFromDate(u.updated_at),
  }
}

const createInput = z.object(userFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...userFields,
})

// Whether the calling user is one of a child's (at most two) parents. This is
// the authorization boundary for editing/removing a child and managing its
// parent links.
async function callerIsParent(
  ctx: Context,
  childId: number,
  callerUserId: number,
): Promise<boolean> {
  const rows = await ctx.db
    .select({ child_user_id: childParentsTable.child_user_id })
    .from(childParentsTable)
    .where(
      and(
        eq(childParentsTable.child_user_id, childId),
        eq(childParentsTable.parent_user_id, callerUserId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

export const userRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const ids = await userIdsForProperty(ctx, input.property_id, ctx.user.id)

    // Children are not group members (visibility flows through child_parents),
    // so they're absent from the group-membership set above. Surface the
    // caller's own children so they can be added as booking occupants.
    const ownChildRows = await ctx.db
      .select({ child_user_id: childParentsTable.child_user_id })
      .from(childParentsTable)
      .where(eq(childParentsTable.parent_user_id, ctx.user.id))
    for (const row of ownChildRows) ids.add(row.child_user_id)

    if (ids.size === 0) return []
    const idList = Array.from(ids)
    const rows = await ctx.db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, idList))
      .orderBy(asc(usersTable.id))

    // Per-property head flag (transitional `is_head` for the client list):
    // head-flagged member of an is_family group of this property.
    const headRows = await ctx.db
      .selectDistinct({ user_id: userGroupMembersTable.user_id })
      .from(userGroupMembersTable)
      .innerJoin(
        userGroupsTable,
        eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
      )
      .where(
        and(
          inArray(userGroupMembersTable.user_id, idList),
          eq(userGroupMembersTable.is_head, true),
          eq(userGroupsTable.is_family, true),
          eq(userGroupsTable.property_id, input.property_id),
        ),
      )
    const headIds = new Set(headRows.map(r => r.user_id))
    return rows.map(u => ({ ...toWireUser(u), is_head: headIds.has(u.id) }))
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const headRows = await ctx.db
      .selectDistinct({ property_id: userGroupsTable.property_id })
      .from(userGroupMembersTable)
      .innerJoin(
        userGroupsTable,
        eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
      )
      .where(
        and(
          eq(userGroupMembersTable.user_id, ctx.user.id),
          eq(userGroupMembersTable.is_head, true),
          eq(userGroupsTable.is_family, true),
        ),
      )
    const head_property_ids = headRows
      .map(r => r.property_id)
      .filter((id): id is number => id != null)
    const mainMembershipRows = await ctx.db
      .select({
        property_id: userGroupsTable.property_id,
        property_name: propertyTable.name,
        user_group_id: userGroupMembersTable.user_group_id,
        is_head: userGroupMembersTable.is_head,
      })
      .from(userGroupMembersTable)
      .innerJoin(
        userGroupsTable,
        eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
      )
      .innerJoin(
        propertyTable,
        eq(propertyTable.id, userGroupsTable.property_id),
      )
      .where(
        and(
          eq(userGroupMembersTable.user_id, ctx.user.id),
          eq(userGroupsTable.is_family, true),
        ),
      )
    // Collapse to one entry per property: a user may belong to multiple
    // family groups for the same property, but "head" is a property-level
    // flag (see updateMyHeadForProperty). is_head is OR'd across groups.
    const byProperty = new Map<
      number,
      {
        property_id: number
        property_name: string
        user_group_id: number
        is_head: boolean
      }
    >()
    for (const r of mainMembershipRows) {
      if (r.property_id == null) continue
      const existing = byProperty.get(r.property_id)
      if (existing) {
        existing.is_head = existing.is_head || r.is_head
      } else {
        byProperty.set(r.property_id, {
          property_id: r.property_id,
          property_name: r.property_name,
          user_group_id: r.user_group_id,
          is_head: r.is_head,
        })
      }
    }
    const my_main_memberships = [...byProperty.values()]
    // is_head kept = is_head_anywhere for transitional client compat.
    // AuthUser carries camelCase createdAt/updatedAt (better-auth shape).
    return {
      ...ctx.user,
      birthday: plainDateFromDbOrNull(ctx.user.birthday),
      onboarding_dismissed_at: instantFromDateOrNull(
        ctx.user.onboarding_dismissed_at,
      ),
      createdAt: instantFromDate(ctx.user.createdAt),
      updatedAt: instantFromDate(ctx.user.updatedAt),
      head_property_ids,
      my_main_memberships,
    }
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const { is_admin, is_child, email, ...rest } = input
      // Role flags may only be set by an admin. Without this gate any logged-in
      // user could self-grant admin by creating a user row (e.g. with their own
      // email) carrying is_admin: true — a privilege-escalation hole. Mirrors
      // the same handling in `update`.
      const roleFields = ctx.user.is_admin ? { is_admin, is_child } : {}
      const [created] = await ctx.db
        .insert(usersTable)
        .values({
          ...rest,
          birthday:
            rest.birthday != null
              ? plainDateToDbString(rest.birthday)
              : rest.birthday,
          email: normalizeEmail(email),
          ...roleFields,
        })
        .returning()
      return toWireUser(created)
    }),

  updateMyName: protectedProcedure
    .input(z.object({ name: z.string().min(1, { error: "name is required" }) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ name: input.name })
        .where(eq(usersTable.id, ctx.user.id))
        .returning()
      return toWireUser(updated)
    }),

  updateMyHeadForProperty: protectedProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        is_head: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = (
        await ctx.db
          .select({ user_group_id: userGroupMembersTable.user_group_id })
          .from(userGroupMembersTable)
          .innerJoin(
            userGroupsTable,
            eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
          )
          .where(
            and(
              eq(userGroupMembersTable.user_id, ctx.user.id),
              eq(userGroupsTable.is_family, true),
              eq(userGroupsTable.property_id, input.property_id),
            ),
          )
          .limit(1)
      ).at(0)
      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "no main-group membership for this property",
        })
      }
      const [updated] = await ctx.db
        .update(userGroupMembersTable)
        .set({ is_head: input.is_head })
        .where(
          and(
            eq(userGroupMembersTable.user_id, ctx.user.id),
            eq(userGroupMembersTable.user_group_id, membership.user_group_id),
          ),
        )
        .returning()
      return updated
    }),

  updateMyBirthday: protectedProcedure
    .input(z.object({ birthday: zPlainDate.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({
          birthday:
            input.birthday != null
              ? plainDateToDbString(input.birthday)
              : null,
        })
        .where(eq(usersTable.id, ctx.user.id))
        .returning()
      return toWireUser(updated)
    }),

  setOnboardingStep: protectedProcedure
    .input(
      z.object({
        step: z.enum([
          "user",
          "basics",
          "buildings",
          "rooms",
          "infrastructure",
          "equipment",
          "expenses",
          "done",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ onboarding_step: input.step })
        .where(eq(usersTable.id, ctx.user.id))
        .returning()
      return toWireUser(updated)
    }),

  dismissOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(usersTable)
      .set({ onboarding_dismissed_at: new Date() })
      .where(eq(usersTable.id, ctx.user.id))
      .returning()
    return toWireUser(updated)
  }),

  listMyChildren: protectedProcedure.query(async ({ ctx }) => {
    const childRows = await ctx.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        creator_id: usersTable.parent_user_id,
      })
      .from(usersTable)
      .innerJoin(
        childParentsTable,
        eq(childParentsTable.child_user_id, usersTable.id),
      )
      .where(eq(childParentsTable.parent_user_id, ctx.user.id))
      .orderBy(asc(usersTable.id))

    if (childRows.length === 0) return []

    const childIds = childRows.map(c => c.id)
    const parentRows = await ctx.db
      .select({
        child_user_id: childParentsTable.child_user_id,
        parent_id: usersTable.id,
        parent_name: usersTable.name,
      })
      .from(childParentsTable)
      .innerJoin(
        usersTable,
        eq(usersTable.id, childParentsTable.parent_user_id),
      )
      .where(inArray(childParentsTable.child_user_id, childIds))

    const creatorByChild = new Map(childRows.map(c => [c.id, c.creator_id]))
    const parentsByChild = new Map<
      number,
      { id: number; name: string; isCreator: boolean }[]
    >()
    for (const p of parentRows) {
      const list = parentsByChild.get(p.child_user_id) ?? []
      list.push({
        id: p.parent_id,
        name: p.parent_name,
        isCreator: p.parent_id === creatorByChild.get(p.child_user_id),
      })
      parentsByChild.set(p.child_user_id, list)
    }
    // Creator (primary parent) first, then by id, so the UI can render a stable
    // "you / co-parent" order and only offer Remove on the non-creator parent.
    for (const list of parentsByChild.values()) {
      list.sort((a, b) =>
        a.isCreator === b.isCreator ? a.id - b.id : a.isCreator ? -1 : 1,
      )
    }

    return childRows.map(c => ({
      id: c.id,
      name: c.name,
      parents: parentsByChild.get(c.id) ?? [],
    }))
  }),

  // Real (non-child) users the caller may link as a second parent: members of
  // any group the caller can see (admins see everyone), minus the caller. The
  // client filters out a child's existing parents per row.
  listLinkableParents: protectedProcedure.query(async ({ ctx }) => {
    let groupIds: number[] | null = null
    if (!ctx.user.is_admin) {
      const ids = await visibleGroupIdsForUser(ctx, ctx.user.id)
      if (ids.size === 0) return []
      groupIds = Array.from(ids)
    }

    return ctx.db
      .selectDistinct({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .innerJoin(
        userGroupMembersTable,
        eq(userGroupMembersTable.user_id, usersTable.id),
      )
      .where(
        and(
          eq(usersTable.is_child, false),
          ne(usersTable.id, ctx.user.id),
          groupIds
            ? inArray(userGroupMembersTable.user_group_id, groupIds)
            : undefined,
        ),
      )
      .orderBy(asc(usersTable.name))
  }),

  createChild: protectedProcedure
    .input(z.object({ name: z.string().min(1, { error: "name is required" }) }))
    .mutation(async ({ ctx, input }) => {
      const email = `child-${String(ctx.user.id)}-${String(Date.now())}@example.local`
      return ctx.db.transaction(async tx => {
        const [created] = await tx
          .insert(usersTable)
          .values({
            name: input.name,
            email,
            is_admin: false,
            is_child: true,
            parent_user_id: ctx.user.id,
          })
          .returning()
        await tx.insert(childParentsTable).values({
          child_user_id: created.id,
          parent_user_id: ctx.user.id,
        })
        return toWireUser(created)
      })
    }),

  updateChild: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1, { error: "name is required" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await callerIsParent(ctx, input.id, ctx.user.id))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      const updated = (
        await ctx.db
          .update(usersTable)
          .set({ name: input.name })
          .where(
            and(eq(usersTable.id, input.id), eq(usersTable.is_child, true)),
          )
          .returning()
      ).at(0)
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      return toWireUser(updated)
    }),

  removeChild: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await callerIsParent(ctx, input.id, ctx.user.id))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      const deleted = (
        await ctx.db
          .delete(usersTable)
          .where(
            and(eq(usersTable.id, input.id), eq(usersTable.is_child, true)),
          )
          .returning()
      ).at(0)
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      return toWireUser(deleted)
    }),

  addParent: protectedProcedure
    .input(
      z.object({
        childId: z.number().int().positive(),
        parentUserId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await callerIsParent(ctx, input.childId, ctx.user.id))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      if (input.parentUserId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "you are already a parent of this child",
        })
      }

      const target = (
        await ctx.db
          .select({ id: usersTable.id, is_child: usersTable.is_child })
          .from(usersTable)
          .where(eq(usersTable.id, input.parentUserId))
          .limit(1)
      ).at(0)
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "user not found" })
      }
      if (target.is_child) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "a child cannot be a parent",
        })
      }

      const existing = await ctx.db
        .select({ parent_user_id: childParentsTable.parent_user_id })
        .from(childParentsTable)
        .where(eq(childParentsTable.child_user_id, input.childId))
      if (existing.some(e => e.parent_user_id === input.parentUserId)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "already a parent of this child",
        })
      }
      if (existing.length >= 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "a child can have at most two parents",
        })
      }

      await ctx.db.insert(childParentsTable).values({
        child_user_id: input.childId,
        parent_user_id: input.parentUserId,
      })
      return { childId: input.childId, parentUserId: input.parentUserId }
    }),

  removeParent: protectedProcedure
    .input(
      z.object({
        childId: z.number().int().positive(),
        parentUserId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await callerIsParent(ctx, input.childId, ctx.user.id))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      const child = (
        await ctx.db
          .select({ creator_id: usersTable.parent_user_id })
          .from(usersTable)
          .where(eq(usersTable.id, input.childId))
          .limit(1)
      ).at(0)
      if (!child) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      // The primary (creating) parent is the anchor and can't be unlinked; to
      // fully remove a child use removeChild.
      if (child.creator_id === input.parentUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cannot remove the primary parent",
        })
      }
      const deleted = (
        await ctx.db
          .delete(childParentsTable)
          .where(
            and(
              eq(childParentsTable.child_user_id, input.childId),
              eq(childParentsTable.parent_user_id, input.parentUserId),
            ),
          )
          .returning()
      ).at(0)
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "parent link not found",
        })
      }
      return deleted
    }),

  // propertyAdminProcedure requires a `property_id` and verifies the caller is
  // a member (or admin) of that property.
  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, is_admin, is_child, email, ...rest } = input
      // Non-admins may only edit users they share a property with — the same
      // population they can already see via listForProperty. Admins keep their
      // global edit-anyone ability.
      if (!ctx.user.is_admin) {
        const propertyUserIds = await userIdsForProperty(
          ctx,
          input.property_id,
          ctx.user.id,
        )
        if (!propertyUserIds.has(id)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "user is not part of this property",
          })
        }
      }
      // Non-admins may edit a user's name/email (e.g. to replace the
      // placeholder email on a quick-added stub user) but must not be able to
      // grant admin or change child status — that would be privilege
      // escalation. Role flags are only applied when the caller is an admin.
      const roleFields = ctx.user.is_admin ? { is_admin, is_child } : {}
      // Normalize the email so it matches the lowercase invariant the auth
      // allowlist and magic-link lookup assume (see auth.ts). Without this a
      // mixed-case email would never resolve to this user at sign-in.
      const newEmail = normalizeEmail(email)
      return ctx.db.transaction(async tx => {
        const existing = (
          await tx
            .select({ email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.id, id))
            .limit(1)
        ).at(0)
        const [updated] = await tx
          .update(usersTable)
          .set({
            ...rest,
            birthday:
              rest.birthday != null
                ? plainDateToDbString(rest.birthday)
                : rest.birthday,
            email: newEmail,
            ...roleFields,
          })
          .where(eq(usersTable.id, id))
          .returning()

        // Replacing a placeholder (synthetic) email with a real one "activates"
        // a quick-added user. Login already works off the users row, but record
        // a claimed invite so the person also shows up in the Invites panel
        // alongside formally-invited users — keeping the two admin views
        // consistent. Skip if an invite for this email+property already exists.
        if (
          existing &&
          isSyntheticEmail(existing.email) &&
          !isSyntheticEmail(newEmail)
        ) {
          const already = (
            await tx
              .select({ id: allowedEmailsTable.id })
              .from(allowedEmailsTable)
              .where(
                and(
                  eq(sql`lower(${allowedEmailsTable.email})`, newEmail),
                  eq(allowedEmailsTable.property_id, input.property_id),
                ),
              )
              .limit(1)
          ).at(0)
          if (!already) {
            // Attribute it to the user's family group for this property when
            // that's unambiguous (exactly one); otherwise leave it null.
            const famGroups = await tx
              .select({ id: userGroupsTable.id })
              .from(userGroupMembersTable)
              .innerJoin(
                userGroupsTable,
                eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
              )
              .where(
                and(
                  eq(userGroupMembersTable.user_id, id),
                  eq(userGroupsTable.property_id, input.property_id),
                  eq(userGroupsTable.is_family, true),
                ),
              )
            await tx.insert(allowedEmailsTable).values({
              email: newEmail,
              property_id: input.property_id,
              user_group_id: famGroups.length === 1 ? famGroups[0].id : null,
              added_by_user_id: ctx.user.id,
              used_at: new Date(),
              used_by_user_id: id,
            })
          }
        }
        return toWireUser(updated)
      })
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      // No existence check above, so the delete may match nothing.
      const deleted = (
        await ctx.db
          .delete(usersTable)
          .where(eq(usersTable.id, input.id))
          .returning()
      ).at(0)
      return deleted ? toWireUser(deleted) : deleted
    }),
})
