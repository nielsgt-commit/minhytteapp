import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { propertyPriorityWeeksTable } from "../../db/schema/property.schema.ts"
import { userGroupsTable } from "../../db/schema/users.schema.ts"
import { isPropertyHead, propertyAdminProcedure, router } from "../init.ts"
import type { AuthUser } from "../context.ts"
import type { db as dbClient } from "../../db/client.ts"

type Db = typeof dbClient

const yearField = z.number().int().min(2000).max(2100)
const peakWeek = z.union([z.literal(28), z.literal(29), z.literal(30)])

async function ensureCanEdit(db: Db, user: AuthUser, propertyId: number) {
  if (!(await isPropertyHead(db, user, propertyId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "must be a household head to edit priority weeks",
    })
  }
}

async function ensureMainGroupOfProperty(
  db: Db,
  userGroupId: number,
  propertyId: number,
) {
  const group = await db
    .select({ id: userGroupsTable.id })
    .from(userGroupsTable)
    .where(
      and(
        eq(userGroupsTable.id, userGroupId),
        eq(userGroupsTable.is_main, true),
        eq(userGroupsTable.property_id, propertyId),
      ),
    )
    .limit(1)
  if (group.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "group is not a family group for this property",
    })
  }
}

export const priorityRouter = router({
  list: propertyAdminProcedure
    .input(
      z.object({
        year: yearField,
      }),
    )
    .query(async ({ ctx, input }) => {
      const eligibleOwners = await ctx.db
        .selectDistinct({
          user_group_id: userGroupsTable.id,
          user_group_name: userGroupsTable.name,
        })
        .from(userGroupsTable)
        .where(
          and(
            eq(userGroupsTable.is_main, true),
            eq(userGroupsTable.property_id, input.property_id),
          ),
        )
        .orderBy(asc(userGroupsTable.name))

      const assignments = await ctx.db
        .select({
          id: propertyPriorityWeeksTable.id,
          user_group_id: propertyPriorityWeeksTable.user_group_id,
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
        user_group_id: z.number().int().positive(),
        year: yearField,
        iso_week: peakWeek,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureCanEdit(ctx.db, ctx.user, input.property_id)
      await ensureMainGroupOfProperty(
        ctx.db,
        input.user_group_id,
        input.property_id,
      )

      return ctx.db.transaction(async tx => {
        await tx
          .delete(propertyPriorityWeeksTable)
          .where(
            and(
              eq(
                propertyPriorityWeeksTable.user_group_id,
                input.user_group_id,
              ),
              eq(propertyPriorityWeeksTable.year, input.year),
            ),
          )
        const [created] = await tx
          .insert(propertyPriorityWeeksTable)
          .values({
            property_id: input.property_id,
            user_group_id: input.user_group_id,
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
        user_group_id: z.number().int().positive(),
        year: yearField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureCanEdit(ctx.db, ctx.user, input.property_id)
      await ensureMainGroupOfProperty(
        ctx.db,
        input.user_group_id,
        input.property_id,
      )

      const rows = await ctx.db
        .delete(propertyPriorityWeeksTable)
        .where(
          and(
            eq(propertyPriorityWeeksTable.user_group_id, input.user_group_id),
            eq(propertyPriorityWeeksTable.property_id, input.property_id),
            eq(propertyPriorityWeeksTable.year, input.year),
          ),
        )
        .returning()
      return rows[0] ?? null
    }),
})
