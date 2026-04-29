import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"

const CATEGORIES: { value: ExpenseType; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "gas", label: "Gas" },
  { value: "maintenance", label: "Maintenance" },
  { value: "capex", label: "Capex" },
  { value: "opex", label: "Opex" },
  { value: "fixed", label: "Fixed" },
]

type ExpenseRow = {
  id: number
  amount: number
  expense_types: ExpenseType[]
}

export function ExpenseCategories() {
  const trpc = useTRPC()
  const { data: expenses } = useSuspenseQuery(trpc.expense.list.queryOptions())

  const totals = new Map<ExpenseType, number>(
    CATEGORIES.map(c => [c.value, 0]),
  )
  for (const e of expenses as ExpenseRow[]) {
    for (const t of e.expense_types) {
      totals.set(t, (totals.get(t) ?? 0) + e.amount)
    }
  }

  return (
    <section>
      <h3>Expense categories</h3>
      <ul>
        {CATEGORIES.map(c => (
          <li key={c.value}>
            {c.label} - {totals.get(c.value) ?? 0}
          </li>
        ))}
      </ul>
    </section>
  )
}