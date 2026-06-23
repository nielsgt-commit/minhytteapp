import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import {
  expensesTable,
  settlementsTable,
} from "../../db/schema/settlement.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import {
  type Temporal,
  plainDateFromDb,
  plainDateToDbString,
  zPlainDate,
} from "../../shared/temporal.ts"
import {
  assertPropertyHead,
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"

// Wire mapping: the `date` column is a "YYYY-MM-DD" string in drizzle —
// convert to Temporal.PlainDate before returning rows.
function toWireExpense<T extends { date: string }>(
  e: T,
): Omit<T, "date"> & { date: Temporal.PlainDate } {
  return { ...e, date: plainDateFromDb(e.date) }
}

type Db = typeof dbClient

async function assertExpensesUnlocked(db: Db, propertyId: number) {
  const open = (
    await db
      .select({ phase: settlementsTable.phase })
      .from(settlementsTable)
      .where(
        and(
          eq(settlementsTable.property_id, propertyId),
          eq(settlementsTable.status, "open"),
        ),
      )
      .limit(1)
  ).at(0)
  if (open && open.phase !== "collecting_expenses") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "expenses are locked: the open settlement is past the collecting phase",
    })
  }
}

// reimbursed/rejected are the "review" outcomes — approving or rejecting a
// submitted expense. Only a property head (or admin) may set them; members keep
// full control of their own draft/submitted expenses. The review UI already
// hides these actions from non-heads, but the API must enforce it too since
// authz is app-layer (no RLS).
function isReviewStatus(status: string) {
  return status === "reimbursed" || status === "rejected"
}

const expenseFields = {
  property_id: z.number().int().positive(),
  description: z.string().default(""),
  amount: z.number().int(),
  reimbursed_by_id: z.number().int().positive().optional(),
  booking_id: z.number().int().positive().optional(),
  maintenance_id: z.number().int().positive().optional(),
  settlement_id: z.number().int().positive().nullish(),
  date: zPlainDate,
  status: z.enum(["draft", "submitted", "reimbursed", "rejected"]),
  receipt_url: z.url().optional().nullable(),
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
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      const rows = await ctx.db
        .select(expenseColumns)
        .from(expensesTable)
        .leftJoin(usersTable, eq(usersTable.id, expensesTable.payer_id))
        .where(eq(expensesTable.property_id, input.property_id))
        .orderBy(asc(expensesTable.date))
      return rows.map(toWireExpense)
    }),

  create: propertyAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      if (input.status === "submitted") {
        await assertExpensesUnlocked(ctx.db, input.property_id)
      }
      if (isReviewStatus(input.status)) {
        await assertPropertyHead(ctx.db, ctx.user, input.property_id)
      }
      const [created] = await ctx.db
        .insert(expensesTable)
        .values({
          ...input,
          date: plainDateToDbString(input.date),
          payer_id: ctx.user.id,
        })
        .returning()
      return toWireExpense(created)
    }),

  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({
            property_id: expensesTable.property_id,
            status: expensesTable.status,
          })
          .from(expensesTable)
          .where(eq(expensesTable.id, input.id))
          .limit(1)
      ).at(0)
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "expense not found" })
      }
      if (existing.property_id !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "cannot reassign expense to another property",
        })
      }
      // Approving/rejecting, or editing an already-reimbursed expense (e.g.
      // un-reimbursing or changing its amount), is a head-only review action.
      if (isReviewStatus(input.status) || existing.status === "reimbursed") {
        await assertPropertyHead(ctx.db, ctx.user, input.property_id)
      }
      if (input.status === "submitted") {
        await assertExpensesUnlocked(ctx.db, input.property_id)
      }
      const { id, property_id: _propertyId, ...rest } = input
      const [updated] = await ctx.db
        .update(expensesTable)
        .set({ ...rest, date: plainDateToDbString(rest.date) })
        .where(eq(expensesTable.id, id))
        .returning()
      return toWireExpense(updated)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({
            property_id: expensesTable.property_id,
            status: expensesTable.status,
          })
          .from(expensesTable)
          .where(eq(expensesTable.id, input.id))
          .limit(1)
      ).at(0)
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "expense not found" })
      }
      if (existing.property_id != null) {
        await assertPropertyMember(ctx.db, ctx.user, existing.property_id)
      }
      // Deleting a reimbursed expense pulls it out of the settlement pot — a
      // head-only action, same as un-reimbursing it.
      if (existing.status === "reimbursed" && existing.property_id != null) {
        await assertPropertyHead(ctx.db, ctx.user, existing.property_id)
      }
      if (existing.status === "submitted" && existing.property_id != null) {
        await assertExpensesUnlocked(ctx.db, existing.property_id)
      }
      const deleted = (
        await ctx.db
          .delete(expensesTable)
          .where(eq(expensesTable.id, input.id))
          .returning()
      ).at(0)
      return deleted ? toWireExpense(deleted) : deleted
    }),
})
