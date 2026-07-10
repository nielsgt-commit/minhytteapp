import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"
import {
  propertyPriorityWeeksTable,
  propertySeasonsTable,
} from "../../db/schema/property.schema.ts"
import { userGroupsTable } from "../../db/schema/users.schema.ts"
import { instantFromDate } from "../../shared/temporal.ts"
import {
  assertPropertyHeadOrAdmin,
  propertyAdminProcedure,
  router,
} from "../init.ts"
import type { AuthUser } from "../context.ts"
import type { db as dbClient } from "../../db/client.ts"

type Db = typeof dbClient

const yearField = z.number().int().min(2000).max(2100)
// Which weeks are pickable is enforced per season (or against the built-in
// fallback weeks when season_id is null), not by the input schema.
const weekField = z.number().int().min(1).max(53)

// Weeks a group may pick when the property has no seasons configured — the
// pre-seasons behavior, kept for properties that never set up seasons.
export const FALLBACK_PEAK_WEEKS = [28, 29, 30]

// Resolve a season for a mutation: must exist, belong to the property, and be
// active. Returns its normalized priority weeks.
async function loadSeasonForEdit(db: Db, seasonId: number, propertyId: number) {
  const season = (
    await db
      .select({
        id: propertySeasonsTable.id,
        property_id: propertySeasonsTable.property_id,
        archived_at: propertySeasonsTable.archived_at,
        priority_weeks: propertySeasonsTable.priority_weeks,
      })
      .from(propertySeasonsTable)
      .where(eq(propertySeasonsTable.id, seasonId))
  ).at(0)
  if (season?.property_id !== propertyId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "season not found" })
  }
  if (season.archived_at != null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "season is archived",
    })
  }
  return season
}

async function ensureCanEdit(db: Db, user: AuthUser, propertyId: number) {
  // Priority weeks are an operator surface: a platform admin may edit any
  // group's pick even without membership. Heads edit their own property.
  await assertPropertyHeadOrAdmin(
    db,
    user,
    propertyId,
    "must be a household head to edit priority weeks",
  )
}

export async function ensureMainGroupOfProperty(
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
        eq(userGroupsTable.is_family, true),
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
            eq(userGroupsTable.is_family, true),
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
          season_id: propertyPriorityWeeksTable.season_id,
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
        iso_week: weekField,
        // null/undefined = the built-in fallback (no seasons configured).
        season_id: z.number().int().positive().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureCanEdit(ctx.db, ctx.user, input.property_id)
      await ensureMainGroupOfProperty(
        ctx.db,
        input.user_group_id,
        input.property_id,
      )

      const seasonId = input.season_id ?? null
      const season =
        seasonId == null
          ? null
          : await loadSeasonForEdit(ctx.db, seasonId, input.property_id)
      const allowedWeeks = season?.priority_weeks ?? FALLBACK_PEAK_WEEKS
      if (!allowedWeeks.includes(input.iso_week)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "week is not a priority week of this season",
        })
      }

      const groupYear = and(
        eq(propertyPriorityWeeksTable.user_group_id, input.user_group_id),
        eq(propertyPriorityWeeksTable.year, input.year),
      )
      // Replace this group's pick for the target season. The season path also
      // sweeps up a legacy NULL-season pick sitting inside this season's
      // weeks, so a group never holds both a legacy and a season row for the
      // same weeks (adoption = delete-then-insert; settlement reads raw rows
      // and must never see duplicates).
      const replaced =
        season == null
          ? and(groupYear, isNull(propertyPriorityWeeksTable.season_id))
          : and(
              groupYear,
              or(
                eq(propertyPriorityWeeksTable.season_id, season.id),
                and(
                  isNull(propertyPriorityWeeksTable.season_id),
                  inArray(
                    propertyPriorityWeeksTable.iso_week,
                    season.priority_weeks,
                  ),
                ),
              ),
            )

      return ctx.db.transaction(async tx => {
        await tx.delete(propertyPriorityWeeksTable).where(replaced)
        const [created] = await tx
          .insert(propertyPriorityWeeksTable)
          .values({
            property_id: input.property_id,
            user_group_id: input.user_group_id,
            year: input.year,
            iso_week: input.iso_week,
            season_id: seasonId,
          })
          .returning()
        return {
          ...created,
          created_at: instantFromDate(created.created_at),
          updated_at: instantFromDate(created.updated_at),
        }
      })
    }),

  clear: propertyAdminProcedure
    .input(
      z.object({
        user_group_id: z.number().int().positive(),
        year: yearField,
        season_id: z.number().int().positive().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureCanEdit(ctx.db, ctx.user, input.property_id)
      await ensureMainGroupOfProperty(
        ctx.db,
        input.user_group_id,
        input.property_id,
      )

      const seasonId = input.season_id ?? null
      const season =
        seasonId == null
          ? null
          : await loadSeasonForEdit(ctx.db, seasonId, input.property_id)

      const groupYear = and(
        eq(propertyPriorityWeeksTable.user_group_id, input.user_group_id),
        eq(propertyPriorityWeeksTable.property_id, input.property_id),
        eq(propertyPriorityWeeksTable.year, input.year),
      )
      // Same predicate as `set`: clearing a season also clears a legacy
      // NULL-season pick that the UI shows adopted into that season.
      const clearWhere =
        season == null
          ? and(groupYear, isNull(propertyPriorityWeeksTable.season_id))
          : and(
              groupYear,
              or(
                eq(propertyPriorityWeeksTable.season_id, season.id),
                season.priority_weeks.length > 0
                  ? and(
                      isNull(propertyPriorityWeeksTable.season_id),
                      inArray(
                        propertyPriorityWeeksTable.iso_week,
                        season.priority_weeks,
                      ),
                    )
                  : undefined,
              ),
            )

      const rows = await ctx.db
        .delete(propertyPriorityWeeksTable)
        .where(clearWhere)
        .returning()
      const cleared = rows.at(0)
      return cleared
        ? {
            ...cleared,
            created_at: instantFromDate(cleared.created_at),
            updated_at: instantFromDate(cleared.updated_at),
          }
        : null
    }),
})
