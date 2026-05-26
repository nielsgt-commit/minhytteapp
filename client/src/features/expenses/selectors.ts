import { STATUS_ORDER } from "./expenseStatus.ts"
import type { ExpenseRow } from "./types.ts"

export function selectExpensesToReview(
  expenses: ExpenseRow[],
  memberIds: Set<number>,
  reviewerId: number,
): ExpenseRow[] {
  return expenses
    .filter(
      e =>
        e.status === "submitted" &&
        memberIds.has(e.payer_id) &&
        e.payer_id !== reviewerId,
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function selectMyExpenses(
  expenses: ExpenseRow[],
  meId: number,
): ExpenseRow[] {
  return expenses
    .filter(e => e.payer_id === meId)
    .slice()
    .sort((a, b) => {
      const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (s !== 0) return s
      return a.date.localeCompare(b.date)
    })
}
