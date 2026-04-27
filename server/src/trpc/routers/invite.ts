import { randomBytes } from "node:crypto"
import { TRPCError } from "@trpc/server"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import {
  propertyInvitationsTable,
  propertyOwnersTable,
  propertyTable,
} from "../../db/schema/property.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import {
  authenticatedProcedure,
  propertyAdminProcedure,
  publicProcedure,
  router,
} from "../init.ts"

const DEFAULT_TTL_DAYS = 14

function newToken(): string {
  return randomBytes(24).toString("hex")
}

const pctField = z.number().min(0).max(100).multipleOf(0.01)

export const inviteRouter = router({
  list: propertyAdminProcedure.query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: propertyInvitationsTable.id,
        token: propertyInvitationsTable.token,
        email: propertyInvitationsTable.email,
        ownership_pct: propertyInvitationsTable.ownership_pct,
        expires_at: propertyInvitationsTable.expires_at,
        used_at: propertyInvitationsTable.used_at,
        used_by_user_id: propertyInvitationsTable.used_by_user_id,
        used_by_name: usersTable.name,
        created_at: propertyInvitationsTable.created_at,
      })
      .from(propertyInvitationsTable)
      .leftJoin(
        usersTable,
        eq(usersTable.id, propertyInvitationsTable.used_by_user_id),
      )
      .where(eq(propertyInvitationsTable.property_id, input.property_id))
      .orderBy(desc(propertyInvitationsTable.created_at))
  }),

  create: propertyAdminProcedure
    .input(
      z.object({
        email: z.email(),
        ownership_pct: pctField,
        ttl_days: z.number().int().positive().max(90).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ttlDays = input.ttl_days ?? DEFAULT_TTL_DAYS
      const expires_at = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
      const [created] = await ctx.db
        .insert(propertyInvitationsTable)
        .values({
          token: newToken(),
          property_id: input.property_id,
          email: input.email,
          ownership_pct: input.ownership_pct.toFixed(2),
          expires_at,
          created_by_user_id: ctx.user.id,
        })
        .returning()
      return created
    }),

  revoke: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = (
        await ctx.db
          .delete(propertyInvitationsTable)
          .where(
            and(
              eq(propertyInvitationsTable.id, input.id),
              eq(propertyInvitationsTable.property_id, input.property_id),
              isNull(propertyInvitationsTable.used_at),
            ),
          )
          .returning()
      ).at(0)
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "invite not found or already accepted",
        })
      }
      return deleted
    }),

  peek: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = (
        await ctx.db
          .select({
            email: propertyInvitationsTable.email,
            expires_at: propertyInvitationsTable.expires_at,
            used_at: propertyInvitationsTable.used_at,
            property_id: propertyInvitationsTable.property_id,
            property_name: propertyTable.name,
          })
          .from(propertyInvitationsTable)
          .innerJoin(
            propertyTable,
            eq(propertyTable.id, propertyInvitationsTable.property_id),
          )
          .where(eq(propertyInvitationsTable.token, input.token))
          .limit(1)
      ).at(0)
      if (!row) return null
      const expired = row.expires_at.getTime() < Date.now()
      const used = row.used_at != null
      return {
        email: row.email,
        property_id: row.property_id,
        property_name: row.property_name,
        expires_at: row.expires_at,
        expired,
        used,
      }
    }),

  accept: authenticatedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const claims = ctx.claims
      return ctx.db.transaction(async tx => {
        const invite = (
          await tx
            .select()
            .from(propertyInvitationsTable)
            .where(eq(propertyInvitationsTable.token, input.token))
            .limit(1)
        ).at(0)
        if (!invite) {
          throw new TRPCError({ code: "NOT_FOUND", message: "invalid invite" })
        }
        if (invite.used_at) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "invite already accepted",
          })
        }
        if (invite.expires_at.getTime() < Date.now()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "invite expired",
          })
        }

        let user = (
          await tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.oauth_sub, claims.sub))
            .limit(1)
        ).at(0)

        if (!user) {
          const byEmail = (
            await tx
              .select()
              .from(usersTable)
              .where(eq(usersTable.email, invite.email))
              .limit(1)
          ).at(0)
          if (byEmail) {
            const [linked] = await tx
              .update(usersTable)
              .set({ oauth_sub: claims.sub })
              .where(eq(usersTable.id, byEmail.id))
              .returning()
            user = linked
          } else {
            const [created] = await tx
              .insert(usersTable)
              .values({
                name: claims.name ?? invite.email,
                email: claims.email ?? invite.email,
                oauth_sub: claims.sub,
                is_admin: false,
              })
              .returning()
            user = created
          }
        }

        const existingOwner = (
          await tx
            .select({ id: propertyOwnersTable.id })
            .from(propertyOwnersTable)
            .where(
              and(
                eq(propertyOwnersTable.property_id, invite.property_id),
                eq(propertyOwnersTable.user_id, user.id),
              ),
            )
            .limit(1)
        ).at(0)

        if (!existingOwner) {
          await tx.insert(propertyOwnersTable).values({
            property_id: invite.property_id,
            user_id: user.id,
            ownership_pct: invite.ownership_pct,
          })
        }

        await tx
          .update(propertyInvitationsTable)
          .set({ used_at: new Date(), used_by_user_id: user.id })
          .where(eq(propertyInvitationsTable.id, invite.id))

        return { property_id: invite.property_id, user_id: user.id }
      })
    }),
})