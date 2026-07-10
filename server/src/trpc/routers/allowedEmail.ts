import { TRPCError } from "@trpc/server"
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import { normalizeEmail } from "../../auth/email.ts"
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
import { wireMap } from "../util/wire.ts"
import {
  assertPropertyHeadOrAdmin,
  headOrAdminProcedure,
  router,
} from "../init.ts"

// Wire mapping: allowed_emails timestamp columns → Temporal.Instant.
const toWireInvite = wireMap({
  used_at: "instantOrNull",
  created_at: "instant",
})

export const allowedEmailRouter = router({
  list: headOrAdminProcedure
    .input(
      z
        .object({ property_id: z.number().int().positive().optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (input?.property_id != null) {
        await assertPropertyHeadOrAdmin(ctx.db, ctx.user, input.property_id)
      } else if (!ctx.user.is_admin) {
        // Without a property_id this returns every invitation in the system;
        // only admins may do that. A property head must scope to a property.
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "admin role required to list all invitations",
        })
      }
      const rows = await ctx.db
        .select({
          id: allowedEmailsTable.id,
          email: allowedEmailsTable.email,
          property_id: allowedEmailsTable.property_id,
          user_group_id: allowedEmailsTable.user_group_id,
          ownership_pct: allowedEmailsTable.ownership_pct,
          used_at: allowedEmailsTable.used_at,
          used_by_user_id: allowedEmailsTable.used_by_user_id,
          added_by_user_id: allowedEmailsTable.added_by_user_id,
          added_by_name: usersTable.name,
          created_at: allowedEmailsTable.created_at,
        })
        .from(allowedEmailsTable)
        .leftJoin(
          usersTable,
          eq(usersTable.id, allowedEmailsTable.added_by_user_id),
        )
        .where(
          input?.property_id != null
            ? eq(allowedEmailsTable.property_id, input.property_id)
            : undefined,
        )
        .orderBy(desc(allowedEmailsTable.created_at))
      return rows.map(r => toWireInvite(r))
    }),

  add: headOrAdminProcedure
    .input(
      z.object({
        email: z.email(),
        property_id: z.number().int().positive().nullable().optional(),
        user_group_id: z.number().int().positive().nullable().optional(),
        ownership_pct: z
          .number()
          .min(0)
          .max(100)
          .multipleOf(0.01)
          .nullable()
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email)
      const property_id = input.property_id ?? null
      const user_group_id = input.user_group_id ?? null
      const ownership_pct = input.ownership_pct ?? null
      if (property_id == null) {
        if (!ctx.user.is_admin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "only admins can create invites without a property",
          })
        }
      } else {
        await assertPropertyHeadOrAdmin(ctx.db, ctx.user, property_id)
        if (user_group_id == null && ownership_pct == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "property invites must set a group or an ownership percentage",
          })
        }
      }
      const ownership_pct_str =
        ownership_pct == null ? null : ownership_pct.toFixed(2)

      return ctx.db.transaction(async tx => {
        const ensureGroupLinkedToProperty = async (
          pid: number,
          gid: number,
        ) => {
          const group = (
            await tx
              .select({ property_id: userGroupsTable.property_id })
              .from(userGroupsTable)
              .where(eq(userGroupsTable.id, gid))
              .limit(1)
          ).at(0)
          if (!group) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "user group not found",
            })
          }
          if (group.property_id == null) {
            await tx
              .update(userGroupsTable)
              .set({ property_id: pid })
              .where(eq(userGroupsTable.id, gid))
            return
          }
          if (group.property_id !== pid) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "selected group is linked to a different property",
            })
          }
        }

        const pending = await tx
          .select({ id: allowedEmailsTable.id })
          .from(allowedEmailsTable)
          .where(
            and(
              eq(sql`lower(${allowedEmailsTable.email})`, email),
              isNull(allowedEmailsTable.used_at),
              property_id == null
                ? isNull(allowedEmailsTable.property_id)
                : eq(allowedEmailsTable.property_id, property_id),
            ),
          )
          .limit(1)
        if (pending.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "an unaccepted invite for this email and property already exists",
          })
        }

        if (property_id != null) {
          const accepted = (
            await tx
              .select()
              .from(allowedEmailsTable)
              .where(
                and(
                  eq(sql`lower(${allowedEmailsTable.email})`, email),
                  eq(allowedEmailsTable.property_id, property_id),
                  isNotNull(allowedEmailsTable.used_at),
                ),
              )
              .limit(1)
          ).at(0)

          if (accepted) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "this person has already accepted an invite for this property; manage their ownership and group membership from the owners/groups panels",
            })
          }

          const existingUser = (
            await tx
              .select({ id: usersTable.id })
              .from(usersTable)
              .where(eq(usersTable.email, email))
              .limit(1)
          ).at(0)

          if (existingUser) {
            const userId = existingUser.id

            if (ownership_pct_str != null && user_group_id != null) {
              const ownerRow = (
                await tx
                  .select({ id: propertyOwnersTable.id })
                  .from(propertyOwnersTable)
                  .where(
                    and(
                      eq(propertyOwnersTable.property_id, property_id),
                      eq(propertyOwnersTable.user_group_id, user_group_id),
                    ),
                  )
                  .limit(1)
              ).at(0)
              if (ownerRow) {
                await tx
                  .update(propertyOwnersTable)
                  .set({ ownership_pct: ownership_pct_str })
                  .where(eq(propertyOwnersTable.id, ownerRow.id))
              } else {
                await tx.insert(propertyOwnersTable).values({
                  property_id,
                  user_group_id,
                  ownership_pct: ownership_pct_str,
                })
              }
            }

            if (user_group_id != null) {
              await tx
                .insert(userGroupMembersTable)
                .values({ user_group_id, user_id: userId })
                .onConflictDoNothing()
              await ensureGroupLinkedToProperty(property_id, user_group_id)
            }

            // They're joining an existing property, so there's nothing to set
            // up — clear the onboarding gate (mirrors applyInvitesForNewUser
            // for brand-new invitees). Guarding on NULL avoids pulling someone
            // out of their own in-progress onboarding wizard.
            await tx
              .update(usersTable)
              .set({ onboarding_step: "done" })
              .where(
                and(
                  eq(usersTable.id, userId),
                  isNull(usersTable.onboarding_step),
                ),
              )

            const [created] = await tx
              .insert(allowedEmailsTable)
              .values({
                email,
                property_id,
                user_group_id,
                ownership_pct: ownership_pct_str,
                added_by_user_id: ctx.user.id,
                used_at: new Date(),
                used_by_user_id: userId,
              })
              .returning()
            return toWireInvite(created)
          }
        }

        if (property_id != null && user_group_id != null) {
          await ensureGroupLinkedToProperty(property_id, user_group_id)
        }

        const [created] = await tx
          .insert(allowedEmailsTable)
          .values({
            email,
            property_id,
            user_group_id,
            ownership_pct: ownership_pct_str,
            added_by_user_id: ctx.user.id,
          })
          .returning()
        return toWireInvite(created)
      })
    }),

  // Tie an existing (unaccepted) property invite to a group, so the invitee is
  // auto-added to that group when they sign up (via applyInvitesForNewUser).
  // Lets a head pick a not-yet-signed-up invitee straight from the group's
  // member picker instead of creating a placeholder user.
  assignGroup: headOrAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        user_group_id: z.number().int().positive(),
        property_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyHeadOrAdmin(ctx.db, ctx.user, input.property_id)
      return ctx.db.transaction(async tx => {
        const invite = (
          await tx
            .select()
            .from(allowedEmailsTable)
            .where(eq(allowedEmailsTable.id, input.id))
            .limit(1)
        ).at(0)
        if (!invite) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "invite not found",
          })
        }
        if (invite.property_id !== input.property_id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "invite is not for this property",
          })
        }
        if (invite.used_at != null) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "invite has already been accepted",
          })
        }

        const group = (
          await tx
            .select({ property_id: userGroupsTable.property_id })
            .from(userGroupsTable)
            .where(eq(userGroupsTable.id, input.user_group_id))
            .limit(1)
        ).at(0)
        if (!group) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "user group not found",
          })
        }
        if (group.property_id == null) {
          await tx
            .update(userGroupsTable)
            .set({ property_id: input.property_id })
            .where(eq(userGroupsTable.id, input.user_group_id))
        } else if (group.property_id !== input.property_id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "selected group is linked to a different property",
          })
        }

        const [updated] = await tx
          .update(allowedEmailsTable)
          .set({ user_group_id: input.user_group_id })
          .where(eq(allowedEmailsTable.id, input.id))
          .returning()
        return toWireInvite(updated)
      })
    }),

  remove: headOrAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const invite = (
        await ctx.db
          .select()
          .from(allowedEmailsTable)
          .where(eq(allowedEmailsTable.id, input.id))
          .limit(1)
      ).at(0)
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "entry not found" })
      }

      if (invite.property_id != null) {
        await assertPropertyHeadOrAdmin(ctx.db, ctx.user, invite.property_id)
      } else if (!ctx.user.is_admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only admins can manage global invites",
        })
      }

      if (invite.used_at == null || invite.property_id == null) {
        const [deleted] = await ctx.db
          .delete(allowedEmailsTable)
          .where(eq(allowedEmailsTable.id, invite.id))
          .returning()
        return toWireInvite(deleted)
      }

      const userId = invite.used_by_user_id
      if (userId == null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "accepted invite is missing used_by_user_id",
        })
      }
      const propertyId = invite.property_id

      return ctx.db.transaction(async tx => {
        if (invite.ownership_pct != null && invite.user_group_id != null) {
          const groupId = invite.user_group_id
          const ownerRow = (
            await tx
              .select({ id: propertyOwnersTable.id })
              .from(propertyOwnersTable)
              .where(
                and(
                  eq(propertyOwnersTable.property_id, propertyId),
                  eq(propertyOwnersTable.user_group_id, groupId),
                ),
              )
              .limit(1)
          ).at(0)
          if (ownerRow) {
            const blockers = await tx
              .select({ id: propertyPriorityWeeksTable.id })
              .from(propertyPriorityWeeksTable)
              .where(eq(propertyPriorityWeeksTable.user_group_id, groupId))
              .limit(1)
            if (blockers.length > 0) {
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  "user has priority week claims; remove them before revoking access",
              })
            }
            await tx
              .delete(propertyOwnersTable)
              .where(eq(propertyOwnersTable.id, ownerRow.id))
          }
        }

        if (invite.user_group_id != null) {
          await tx
            .delete(userGroupMembersTable)
            .where(
              and(
                eq(userGroupMembersTable.user_group_id, invite.user_group_id),
                eq(userGroupMembersTable.user_id, userId),
              ),
            )
        }

        const [deleted] = await tx
          .delete(allowedEmailsTable)
          .where(eq(allowedEmailsTable.id, invite.id))
          .returning()
        return toWireInvite(deleted)
      })
    }),
})
