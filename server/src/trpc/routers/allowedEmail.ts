import { TRPCError } from "@trpc/server"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { normalizeEmail } from "../../auth/email.ts"
import { allowedEmailsTable, usersTable } from "../../db/schema/users.schema.ts"
import { assertPropertyMember, headOrAdminProcedure, router } from "../init.ts"

export const allowedEmailRouter = router({
  list: headOrAdminProcedure
    .input(
      z
        .object({ property_id: z.number().int().positive().optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
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
      if (property_id != null) {
        await assertPropertyMember(ctx.db, ctx.user, property_id)
      }
      const existing = await ctx.db
        .select({ id: allowedEmailsTable.id })
        .from(allowedEmailsTable)
        .where(
          and(
            eq(allowedEmailsTable.email, email),
            isNull(allowedEmailsTable.used_at),
            property_id == null
              ? isNull(allowedEmailsTable.property_id)
              : eq(allowedEmailsTable.property_id, property_id),
          ),
        )
        .limit(1)
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "an unaccepted invite for this email and property already exists",
        })
      }
      const [created] = await ctx.db
        .insert(allowedEmailsTable)
        .values({
          email,
          property_id,
          user_group_id: input.user_group_id ?? null,
          ownership_pct:
            input.ownership_pct == null ? null : input.ownership_pct.toFixed(2),
          added_by_user_id: ctx.user.id,
        })
        .returning()
      return created
    }),

  remove: headOrAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = (
        await ctx.db
          .delete(allowedEmailsTable)
          .where(eq(allowedEmailsTable.id, input.id))
          .returning()
      ).at(0)
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "entry not found" })
      }
      return deleted
    }),
})
