import type { ExpenseRow } from "./types.ts"

type Category = { id: number; name: string }

export type CategoryTotals = {
  perCategory: Map<string, number>
  uncategorized: number
}

export function useCategoryTotals(
  expenses: ExpenseRow[],
  categories: Category[],
): CategoryTotals {
  const perCategory = new Map<string, number>(categories.map(c => [c.name, 0]))
  let uncategorized = 0
  for (const e of expenses) {
    if (e.expense_types.length === 0) {
      uncategorized += e.amount
      continue
    }
    for (const t of e.expense_types) {
      perCategory.set(t, (perCategory.get(t) ?? 0) + e.amount)
    }
  }
  return { perCategory, uncategorized }
}
