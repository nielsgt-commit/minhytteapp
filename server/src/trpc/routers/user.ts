import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { propertyTable } from "../../db/schema/property.schema.ts"
import {
  allowedEmailsTable,
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
import { userIdsForProperty } from "./userGroup.ts"
import { isSyntheticEmail, normalizeEmail } from "../../auth/email.ts"

const birthdayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "expected YYYY-MM-DD" })

const userFields = {
  name: z.string().min(1, { error: "name is required" }),
  email: z.email(),
  is_admin: z.boolean().optional(),
  is_child: z.boolean().optional(),
  birthday: birthdayString.nullable().optional(),
}

const createInput = z.object(userFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...userFields,
})

export const userRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const ids = await userIdsForProperty(ctx, input.property_id, ctx.user.id)

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
    return rows.map(u => ({ ...u, is_head: headIds.has(u.id) }))
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
    const my_main_memberships = mainMembershipRows
      .filter(
        (r): r is typeof r & { property_id: number } => r.property_id != null,
      )
      .map(r => ({
        property_id: r.property_id,
        property_name: r.property_name,
        user_group_id: r.user_group_id,
        is_head: r.is_head,
      }))
    // is_head kept = is_head_anywhere for transitional client compat.
    return { ...ctx.user, head_property_ids, my_main_memberships }
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
    .input(z.object({ birthday: birthdayString.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(usersTable)
        .set({ birthday: input.birthday })
        .where(eq(usersTable.id, ctx.user.id))
        .returning()
      return updated
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
      return updated
    }),

  dismissOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(usersTable)
      .set({ onboarding_dismissed_at: new Date() })
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
      const updated = (
        await ctx.db
          .update(usersTable)
          .set({ name: input.name })
          .where(
            and(
              eq(usersTable.id, input.id),
              eq(usersTable.parent_user_id, ctx.user.id),
            ),
          )
          .returning()
      ).at(0)
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
      }
      return updated
    }),

  removeChild: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = (
        await ctx.db
          .delete(usersTable)
          .where(
            and(
              eq(usersTable.id, input.id),
              eq(usersTable.parent_user_id, ctx.user.id),
            ),
          )
          .returning()
      ).at(0)
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "child not found" })
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
          .set({ ...rest, email: newEmail, ...roleFields })
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
        return updated
      })
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
