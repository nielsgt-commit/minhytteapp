import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import {
  propertyOwnersTable,
} from "../../db/schema/property.schema.ts"
import {
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const pctField = z
  .number()
  .min(0)
  .max(100)
  .multipleOf(0.01)

export const propertyOwnerRouter = router({
  list: publicProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: propertyOwnersTable.id,
          property_id: propertyOwnersTable.property_id,
          user_id: propertyOwnersTable.user_id,
          user_group_id: propertyOwnersTable.user_group_id,
          ownership_pct: propertyOwnersTable.ownership_pct,
          user_name: usersTable.name,
          user_group_name: userGroupsTable.name,
        })
        .from(propertyOwnersTable)
        .leftJoin(usersTable, eq(usersTable.id, propertyOwnersTable.user_id))
        .leftJoin(
          userGroupsTable,
          eq(userGroupsTable.id, propertyOwnersTable.user_group_id),
        )
        .where(eq(propertyOwnersTable.property_id, input.property_id))
        .orderBy(asc(propertyOwnersTable.id))
      return rows
    }),

  addUser: protectedProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        user_id: z.number().int().positive(),
        ownership_pct: pctField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(propertyOwnersTable)
        .values({
          property_id: input.property_id,
          user_id: input.user_id,
          ownership_pct: input.ownership_pct.toFixed(2),
        })
        .returning()
      return created
    }),

  addGroup: protectedProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        user_group_id: z.number().int().positive(),
        ownership_pct: pctField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

  updatePct: protectedProcedure
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
        .where(eq(propertyOwnersTable.id, input.id))
        .returning()
      return updated
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(propertyOwnersTable)
        .where(eq(propertyOwnersTable.id, input.id))
        .returning()
      return deleted
    }),
})
