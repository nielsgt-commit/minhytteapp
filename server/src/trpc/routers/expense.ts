import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { expensesTable } from "../../db/schema/settlement.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const expenseFields = {
  description: z.string().min(1),
  amount: z.number().int(),
  payer_id: z.number().int().positive(),
  reimbursed_by_id: z.number().int().positive().optional(),
  booking_id: z.number().int().positive().optional(),
  maintenance_id: z.number().int().positive().optional(),
  settlement_id: z.number().int().positive().optional(),
  timestamp: z.string().min(1),
  status: z.enum(["submitted", "reimbursed", "rejected"]),
}

const reimbursedHasReimburser = {
  check: (v: { status: string; reimbursed_by_id?: number }) =>
    v.status !== "reimbursed" || v.reimbursed_by_id != null,
  error: "reimbursed_by_id is required when status is 'reimbursed'",
  path: ["reimbursed_by_id"] as const,
}

const reimburserNotPayer = {
  check: (v: { payer_id: number; reimbursed_by_id?: number }) =>
    v.reimbursed_by_id == null || v.reimbursed_by_id !== v.payer_id,
  error: "reimbursed_by_id must differ from payer_id",
  path: ["reimbursed_by_id"] as const,
}

const createInput = z
  .object(expenseFields)
  .refine(reimbursedHasReimburser.check, {
    error: reimbursedHasReimburser.error,
    path: [...reimbursedHasReimburser.path],
  })
  .refine(reimburserNotPayer.check, {
    error: reimburserNotPayer.error,
    path: [...reimburserNotPayer.path],
  })

const updateInput = z
  .object({ id: z.number().int().positive(), ...expenseFields })
  .refine(reimbursedHasReimburser.check, {
    error: reimbursedHasReimburser.error,
    path: [...reimbursedHasReimburser.path],
  })
  .refine(reimburserNotPayer.check, {
    error: reimburserNotPayer.error,
    path: [...reimburserNotPayer.path],
  })

export const expenseRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: expensesTable.id,
        description: expensesTable.description,
        amount: expensesTable.amount,
        payer_id: expensesTable.payer_id,
        payer_name: usersTable.name,
        reimbursed_by_id: expensesTable.reimbursed_by_id,
        booking_id: expensesTable.booking_id,
        maintenance_id: expensesTable.maintenance_id,
        settlement_id: expensesTable.settlement_id,
        timestamp: expensesTable.timestamp,
        status: expensesTable.status,
      })
      .from(expensesTable)
      .leftJoin(usersTable, eq(usersTable.id, expensesTable.payer_id))
      .orderBy(asc(expensesTable.timestamp))
    return rows
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(expensesTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
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
      const [deleted] = await ctx.db
        .delete(expensesTable)
        .where(eq(expensesTable.id, input.id))
        .returning()
      return deleted
    }),
})