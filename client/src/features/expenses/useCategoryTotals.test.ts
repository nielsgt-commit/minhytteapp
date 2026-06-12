import { Temporal } from "temporal-polyfill"
import { describe, expect, test } from "vitest"
import { useCategoryTotals } from "./useCategoryTotals.ts"
import type { ExpenseRow } from "./types.ts"

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: 1,
    property_id: 10,
    description: "",
    amount: 0,
    payer_id: 1,
    payer_name: null,
    reimbursed_by_id: null,
    booking_id: null,
    maintenance_id: null,
    settlement_id: null,
    date: Temporal.PlainDate.from("2026-01-01"),
    status: "submitted",
    receipt_url: null,
    expense_types: [],
    ...overrides,
  }
}

describe("useCategoryTotals", () => {
  test("seeds perCategory with every category at zero", () => {
    const { perCategory, uncategorized } = useCategoryTotals(
      [],
      [
        { id: 1, name: "food" },
        { id: 2, name: "gas" },
      ],
    )
    expect(perCategory.get("food")).toBe(0)
    expect(perCategory.get("gas")).toBe(0)
    expect(uncategorized).toBe(0)
  })

  test("counts amount toward each listed category, full amount per category", () => {
    const expenses = [
      makeExpense({ amount: 100, expense_types: ["food"] }),
      makeExpense({ amount: 50, expense_types: ["food", "gas"] }),
    ]
    const { perCategory } = useCategoryTotals(expenses, [
      { id: 1, name: "food" },
      { id: 2, name: "gas" },
    ])
    expect(perCategory.get("food")).toBe(150)
    expect(perCategory.get("gas")).toBe(50)
  })

  test("expenses with no category contribute to uncategorized", () => {
    const expenses = [
      makeExpense({ amount: 30, expense_types: [] }),
      makeExpense({ amount: 20, expense_types: [] }),
      makeExpense({ amount: 5, expense_types: ["food"] }),
    ]
    const { uncategorized } = useCategoryTotals(expenses, [
      { id: 1, name: "food" },
    ])
    expect(uncategorized).toBe(50)
  })
})
