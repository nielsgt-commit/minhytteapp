import type { Temporal } from "temporal-polyfill"
import type { ExpenseRow, Status } from "./types.ts"

/**
 * Base shape shared between Review and MyExpense update flows.
 * Carries the fields that callers rarely override.
 */
export function basePayload(e: ExpenseRow, fallbackPropertyId: number) {
  return {
    id: e.id,
    property_id: e.property_id ?? fallbackPropertyId,
    description: e.description,
    amount: e.amount,
    booking_id: e.booking_id ?? undefined,
    maintenance_id: e.maintenance_id ?? undefined,
    date: e.date,
    receipt_url: e.receipt_url,
    expense_types: e.expense_types,
  }
}

type UpdateOverrides = {
  description?: string
  amount?: number
  date?: Temporal.PlainDate
  status: Status
  reimbursed_by_id?: number
  settlement_id?: number | null
}

/**
 * Variant used by MyExpenseCard where description/amount/date can be edited.
 */
export function toUpdateInput(
  e: ExpenseRow,
  fallbackPropertyId: number,
  overrides: UpdateOverrides,
) {
  return {
    id: e.id,
    property_id: e.property_id ?? fallbackPropertyId,
    description: overrides.description ?? e.description,
    amount: overrides.amount ?? e.amount,
    reimbursed_by_id:
      overrides.reimbursed_by_id ?? e.reimbursed_by_id ?? undefined,
    booking_id: e.booking_id ?? undefined,
    maintenance_id: e.maintenance_id ?? undefined,
    settlement_id:
      overrides.settlement_id !== undefined
        ? overrides.settlement_id
        : (e.settlement_id ?? undefined),
    date: overrides.date ?? e.date,
    status: overrides.status,
    receipt_url: e.receipt_url,
    expense_types: e.expense_types,
  }
}
