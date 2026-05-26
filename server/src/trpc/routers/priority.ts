import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import {
  propertyOwnersTable,
  propertyPriorityWeeksTable,
} from "../../db/schema/property.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { propertyAdminProcedure, publicProcedure, router } from "../init.ts"

const yearField = z.number().int().min(2000).max(2100)
const peakWeek = z.union([z.literal(28), z.literal(29), z.literal(30)])

function ensureCanEdit(user: { is_head: boolean; is_admin: boolean }) {
  if (!user.is_head && !user.is_admin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "must be a household head to edit priority weeks",
    })
  }
}

function ensureOwnsRow(
  user: { id: number; is_admin: boolean },
  ownerUserId: number | null,
) {
  if (user.is_admin) return
  if (ownerUserId !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "you can only edit your own priority week",
    })
  }
}

export const priorityRouter = router({
  list: publicProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        year: yearField,
      }),
    )
    .query(async ({ ctx, input }) => {
      const eligibleOwners = await ctx.db
        .select({
          property_owner_id: propertyOwnersTable.id,
          user_id: usersTable.id,
          user_name: usersTable.name,
        })
        .from(propertyOwnersTable)
        .innerJoin(usersTable, eq(usersTable.id, propertyOwnersTable.user_id))
        .where(
          and(
            eq(propertyOwnersTable.property_id, input.property_id),
            eq(usersTable.is_head, true),
          ),
        )
        .orderBy(asc(usersTable.name))

      const assignments = await ctx.db
        .select({
          id: propertyPriorityWeeksTable.id,
          property_owner_id: propertyPriorityWeeksTable.property_owner_id,
          year: propertyPriorityWeeksTable.year,
          iso_week: propertyPriorityWeeksTable.iso_week,
        })
        .from(propertyPriorityWeeksTable)
        .where(
          and(
            eq(propertyPriorityWeeksTable.property_id, input.property_id),
            eq(propertyPriorityWeeksTable.year, input.year),
          ),
        )

      return { eligibleOwners, assignments }
    }),

  set: propertyAdminProcedure
    .input(
      z.object({
        property_owner_id: z.number().int().positive(),
        year: yearField,
        iso_week: peakWeek,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      ensureCanEdit(ctx.user)

      const owner = (
        await ctx.db
          .select({
            id: propertyOwnersTable.id,
            user_id: propertyOwnersTable.user_id,
            is_head: usersTable.is_head,
          })
          .from(propertyOwnersTable)
          .innerJoin(usersTable, eq(usersTable.id, propertyOwnersTable.user_id))
          .where(
            and(
              eq(propertyOwnersTable.id, input.property_owner_id),
              eq(propertyOwnersTable.property_id, input.property_id),
            ),
          )
          .limit(1)
      ).at(0)
      if (!owner) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "owner not found for this property",
        })
      }
      if (!owner.is_head) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "owner is not flagged as a household head",
        })
      }
      ensureOwnsRow(ctx.user, owner.user_id)

      return ctx.db.transaction(async tx => {
        await tx
          .delete(propertyPriorityWeeksTable)
          .where(
            and(
              eq(
                propertyPriorityWeeksTable.property_owner_id,
                input.property_owner_id,
              ),
              eq(propertyPriorityWeeksTable.year, input.year),
            ),
          )
        const [created] = await tx
          .insert(propertyPriorityWeeksTable)
          .values({
            property_id: input.property_id,
            property_owner_id: input.property_owner_id,
            year: input.year,
            iso_week: input.iso_week,
          })
          .returning()
        return created
      })
    }),

  clear: propertyAdminProcedure
    .input(
      z.object({
        property_owner_id: z.number().int().positive(),
        year: yearField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      ensureCanEdit(ctx.user)

      const owner = (
        await ctx.db
          .select({ user_id: propertyOwnersTable.user_id })
          .from(propertyOwnersTable)
          .where(
            and(
              eq(propertyOwnersTable.id, input.property_owner_id),
              eq(propertyOwnersTable.property_id, input.property_id),
            ),
          )
          .limit(1)
      ).at(0)
      if (!owner) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "owner not found for this property",
        })
      }
      ensureOwnsRow(ctx.user, owner.user_id)

      const rows = await ctx.db
        .delete(propertyPriorityWeeksTable)
        .where(
          and(
            eq(
              propertyPriorityWeeksTable.property_owner_id,
              input.property_owner_id,
            ),
            eq(propertyPriorityWeeksTable.property_id, input.property_id),
            eq(propertyPriorityWeeksTable.year, input.year),
          ),
        )
        .returning()
      return rows[0] ?? null
    }),
})
