import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import {
  expensesTable,
  settlementsTable,
} from "../../db/schema/settlement.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

type Db = typeof dbClient

async function assertExpensesUnlocked(db: Db, propertyId: number) {
  const [open] = await db
    .select({ phase: settlementsTable.phase })
    .from(settlementsTable)
    .where(
      and(
        eq(settlementsTable.property_id, propertyId),
        eq(settlementsTable.status, "open"),
      ),
    )
    .limit(1)
  if (open && open.phase !== "collecting_expenses") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "expenses are locked: the open settlement is past the collecting phase",
    })
  }
}

const expenseFields = {
  property_id: z.number().int().positive(),
  description: z.string().default(""),
  amount: z.number().int(),
  reimbursed_by_id: z.number().int().positive().optional(),
  booking_id: z.number().int().positive().optional(),
  maintenance_id: z.number().int().positive().optional(),
  settlement_id: z.number().int().positive().nullish(),
  date: z.iso.date(),
  status: z.enum(["draft", "submitted", "reimbursed", "rejected"]),
  receipt_url: z.string().url().optional().nullable(),
  expense_types: z.array(z.string().min(1).max(64)).default([]),
}

const reimbursedHasReimburser = {
  check: (v: { status: string; reimbursed_by_id?: number }) =>
    v.status !== "reimbursed" || v.reimbursed_by_id != null,
  error: "reimbursed_by_id is required when status is 'reimbursed'",
  path: ["reimbursed_by_id"] as const,
}

const createInput = z
  .object(expenseFields)
  .refine(reimbursedHasReimburser.check, {
    error: reimbursedHasReimburser.error,
    path: [...reimbursedHasReimburser.path],
  })

const updateInput = z
  .object({ id: z.number().int().positive(), ...expenseFields })
  .refine(reimbursedHasReimburser.check, {
    error: reimbursedHasReimburser.error,
    path: [...reimbursedHasReimburser.path],
  })

const expenseColumns = {
  id: expensesTable.id,
  property_id: expensesTable.property_id,
  description: expensesTable.description,
  amount: expensesTable.amount,
  payer_id: expensesTable.payer_id,
  payer_name: usersTable.name,
  reimbursed_by_id: expensesTable.reimbursed_by_id,
  booking_id: expensesTable.booking_id,
  maintenance_id: expensesTable.maintenance_id,
  settlement_id: expensesTable.settlement_id,
  date: expensesTable.date,
  status: expensesTable.status,
  receipt_url: expensesTable.receipt_url,
  expense_types: expensesTable.expense_types,
}

export const expenseRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select(expenseColumns)
      .from(expensesTable)
      .leftJoin(usersTable, eq(usersTable.id, expensesTable.payer_id))
      .orderBy(asc(expensesTable.date))
  }),

  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select(expenseColumns)
        .from(expensesTable)
        .leftJoin(usersTable, eq(usersTable.id, expensesTable.payer_id))
        .where(eq(expensesTable.property_id, input.property_id))
        .orderBy(asc(expensesTable.date))
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      if (input.status === "submitted") {
        await assertExpensesUnlocked(ctx.db, input.property_id)
      }
      const [created] = await ctx.db
        .insert(expensesTable)
        .values({ ...input, payer_id: ctx.user.id })
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      if (input.status === "submitted") {
        await assertExpensesUnlocked(ctx.db, input.property_id)
      }
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(expensesTable)
        .set(rest)
        .where(eq(expensesTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          property_id: expensesTable.property_id,
          status: expensesTable.status,
        })
        .from(expensesTable)
        .where(eq(expensesTable.id, input.id))
        .limit(1)
      if (
        existing
        && existing.status === "submitted"
        && existing.property_id != null
      ) {
        await assertExpensesUnlocked(ctx.db, existing.property_id)
      }
      const [deleted] = await ctx.db
        .delete(expensesTable)
        .where(eq(expensesTable.id, input.id))
        .returning()
      return deleted
    }),
})