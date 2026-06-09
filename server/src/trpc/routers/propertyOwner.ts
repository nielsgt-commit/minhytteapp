import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { propertyOwnersTable } from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
} from "../../db/schema/users.schema.ts"
import { propertyAdminProcedure, router } from "../init.ts"

const pctField = z.number().min(0).max(100).multipleOf(0.01)

export const propertyOwnerRouter = router({
  list: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: propertyOwnersTable.id,
        property_id: propertyOwnersTable.property_id,
        user_group_id: propertyOwnersTable.user_group_id,
        ownership_pct: propertyOwnersTable.ownership_pct,
        user_group_name: userGroupsTable.name,
      })
      .from(propertyOwnersTable)
      .leftJoin(
        userGroupsTable,
        eq(userGroupsTable.id, propertyOwnersTable.user_group_id),
      )
      .where(eq(propertyOwnersTable.property_id, input.property_id))
      .orderBy(asc(propertyOwnersTable.id))
    return rows
  }),

  addUser: propertyAdminProcedure
    .input(
      z.object({
        user_id: z.number().int().positive(),
        ownership_pct: pctField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyGroup = (
        await ctx.db
          .select({ user_group_id: userGroupsTable.id })
          .from(userGroupMembersTable)
          .innerJoin(
            userGroupsTable,
            eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
          )
          .where(
            and(
              eq(userGroupMembersTable.user_id, input.user_id),
              eq(userGroupsTable.is_family, true),
              eq(userGroupsTable.property_id, input.property_id),
            ),
          )
          .limit(1)
      ).at(0)
      if (!familyGroup) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "user has no family group for this property",
        })
      }
      const [created] = await ctx.db
        .insert(propertyOwnersTable)
        .values({
          property_id: input.property_id,
          user_group_id: familyGroup.user_group_id,
          ownership_pct: input.ownership_pct.toFixed(2),
        })
        .returning()
      return created
    }),

  addGroup: propertyAdminProcedure
    .input(
      z.object({
        user_group_id: z.number().int().positive(),
        ownership_pct: pctField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // The group must belong to this property (like addUser, which only
      // resolves family groups scoped to input.property_id). Without this a
      // member could attach an arbitrary group as an owner of their property.
      const group = (
        await ctx.db
          .select({ property_id: userGroupsTable.property_id })
          .from(userGroupsTable)
          .where(eq(userGroupsTable.id, input.user_group_id))
          .limit(1)
      ).at(0)
      if (!group || group.property_id !== input.property_id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "group does not belong to this property",
        })
      }
      const [created] = await ctx.db
        .insert(propertyOwnersTable)
        .values({
          property_id: input.property_id,
          user_group_id: input.user_group_id,
          ownership_pct: input.ownership_pct.toFixed(2),
        })
        .returning()
      return created
    }),

  updatePct: propertyAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        ownership_pct: pctField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(propertyOwnersTable)
        .set({ ownership_pct: input.ownership_pct.toFixed(2) })
        .where(
          and(
            eq(propertyOwnersTable.id, input.id),
            eq(propertyOwnersTable.property_id, input.property_id),
          ),
        )
        .returning()
      return updated
    }),

  remove: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(propertyOwnersTable)
        .where(
          and(
            eq(propertyOwnersTable.id, input.id),
            eq(propertyOwnersTable.property_id, input.property_id),
          ),
        )
        .returning()
      return deleted
    }),
})
