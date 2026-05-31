import { TRPCError } from "@trpc/server"
import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import {
  expenseCategoriesTable,
  expensesTable,
} from "../../db/schema/settlement.schema.ts"
import {
  propertyAdminProcedure,
  propertyHeadOrAdminProcedure,
  router,
} from "../init.ts"

export const expenseCategoryRouter = router({
  list: propertyAdminProcedure.query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: expenseCategoriesTable.id,
        name: expenseCategoriesTable.name,
      })
      .from(expenseCategoriesTable)
      .where(
        and(
          eq(expenseCategoriesTable.property_id, input.property_id),
          isNull(expenseCategoriesTable.archived_at),
        ),
      )
      .orderBy(asc(expenseCategoriesTable.name))
  }),

  listAllForDisplay: propertyAdminProcedure.query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: expenseCategoriesTable.id,
        name: expenseCategoriesTable.name,
        archived_at: expenseCategoriesTable.archived_at,
      })
      .from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.property_id, input.property_id))
      .orderBy(asc(expenseCategoriesTable.name))
  }),

  create: propertyHeadOrAdminProcedure
    .input(z.object({ name: z.string().trim().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(expenseCategoriesTable)
        .values({ name: input.name, property_id: input.property_id })
        .returning()
      return created
    }),

  rename: propertyHeadOrAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async tx => {
        const existing = (
          await tx
            .select({
              property_id: expenseCategoriesTable.property_id,
              name: expenseCategoriesTable.name,
              archived_at: expenseCategoriesTable.archived_at,
            })
            .from(expenseCategoriesTable)
            .where(eq(expenseCategoriesTable.id, input.id))
        ).at(0)
        if (existing?.property_id !== input.property_id) {
          throw new TRPCError({ code: "NOT_FOUND" })
        }
        if (existing.archived_at != null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "cannot rename an archived category; unarchive first",
          })
        }
        const [updated] = await tx
          .update(expenseCategoriesTable)
          .set({ name: input.name })
          .where(eq(expenseCategoriesTable.id, input.id))
          .returning()
        if (existing.name !== input.name) {
          await tx
            .update(expensesTable)
            .set({
              expense_types: sql`array_replace(${expensesTable.expense_types}, ${existing.name}, ${input.name})`,
            })
            .where(eq(expensesTable.property_id, input.property_id))
        }
        return updated
      })
    }),

  archive: propertyHeadOrAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({ property_id: expenseCategoriesTable.property_id })
          .from(expenseCategoriesTable)
          .where(eq(expenseCategoriesTable.id, input.id))
      ).at(0)
      if (existing?.property_id !== input.property_id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      const [archived] = await ctx.db
        .update(expenseCategoriesTable)
        .set({ archived_at: new Date() })
        .where(eq(expenseCategoriesTable.id, input.id))
        .returning()
      return archived
    }),

  unarchive: propertyHeadOrAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({ property_id: expenseCategoriesTable.property_id })
          .from(expenseCategoriesTable)
          .where(eq(expenseCategoriesTable.id, input.id))
      ).at(0)
      if (existing?.property_id !== input.property_id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      const [unarchived] = await ctx.db
        .update(expenseCategoriesTable)
        .set({ archived_at: null })
        .where(eq(expenseCategoriesTable.id, input.id))
        .returning()
      return unarchived
    }),
})
