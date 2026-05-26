import { TRPCError } from "@trpc/server"
import { asc, eq, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import {
  expenseCategoriesTable,
  expensesTable,
} from "../../db/schema/settlement.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const headProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.is_head) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "must be a head to manage expense categories",
    })
  }
  return next()
})

export const expenseCategoryRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: expenseCategoriesTable.id,
        name: expenseCategoriesTable.name,
      })
      .from(expenseCategoriesTable)
      .where(isNull(expenseCategoriesTable.archived_at))
      .orderBy(asc(expenseCategoriesTable.name))
  }),

  listAllForDisplay: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: expenseCategoriesTable.id,
        name: expenseCategoriesTable.name,
        archived_at: expenseCategoriesTable.archived_at,
      })
      .from(expenseCategoriesTable)
      .orderBy(asc(expenseCategoriesTable.name))
  }),

  create: headProcedure
    .input(z.object({ name: z.string().trim().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(expenseCategoriesTable)
        .values({ name: input.name })
        .returning()
      return created
    }),

  rename: headProcedure
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
              name: expenseCategoriesTable.name,
              archived_at: expenseCategoriesTable.archived_at,
            })
            .from(expenseCategoriesTable)
            .where(eq(expenseCategoriesTable.id, input.id))
        ).at(0)
        if (!existing) {
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
          await tx.update(expensesTable).set({
            expense_types: sql`array_replace(${expensesTable.expense_types}, ${existing.name}, ${input.name})`,
          })
        }
        return updated
      })
    }),

  archive: headProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const archived = (
        await ctx.db
          .update(expenseCategoriesTable)
          .set({ archived_at: new Date() })
          .where(eq(expenseCategoriesTable.id, input.id))
          .returning()
      ).at(0)
      if (!archived) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return archived
    }),

  unarchive: headProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const unarchived = (
        await ctx.db
          .update(expenseCategoriesTable)
          .set({ archived_at: null })
          .where(eq(expenseCategoriesTable.id, input.id))
          .returning()
      ).at(0)
      if (!unarchived) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return unarchived
    }),
})
