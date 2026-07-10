import { TRPCError } from "@trpc/server"
import { and, asc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { equipmentCategoriesTable } from "../../db/schema/maintenance.schema.ts"
import { wireMap } from "../util/wire.ts"
import {
  propertyAdminProcedure,
  propertyHeadOrAdminProcedure,
  router,
} from "../init.ts"

// Wire mapping: archived_at (nullable timestamp) → Temporal.Instant | null.
const toWireCategory = wireMap({ archived_at: "instantOrNull" })

export const equipmentCategoryRouter = router({
  list: propertyAdminProcedure.query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: equipmentCategoriesTable.id,
        name: equipmentCategoriesTable.name,
      })
      .from(equipmentCategoriesTable)
      .where(
        and(
          eq(equipmentCategoriesTable.property_id, input.property_id),
          isNull(equipmentCategoriesTable.archived_at),
        ),
      )
      .orderBy(asc(equipmentCategoriesTable.name))
  }),

  create: propertyHeadOrAdminProcedure
    .input(z.object({ name: z.string().trim().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(equipmentCategoriesTable)
        .values({ name: input.name, property_id: input.property_id })
        .returning()
      return toWireCategory(created)
    }),

  archive: propertyHeadOrAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({ property_id: equipmentCategoriesTable.property_id })
          .from(equipmentCategoriesTable)
          .where(eq(equipmentCategoriesTable.id, input.id))
      ).at(0)
      if (existing?.property_id !== input.property_id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      const [archived] = await ctx.db
        .update(equipmentCategoriesTable)
        .set({ archived_at: new Date() })
        .where(eq(equipmentCategoriesTable.id, input.id))
        .returning()
      return toWireCategory(archived)
    }),
})
