import { Temporal } from "temporal-polyfill"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { MyExpenseRow } from "./MyExpenseRow.tsx"
import type { ExpenseRow } from "../types.ts"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: 1,
    property_id: 10,
    description: "Coffee",
    amount: 75,
    payer_id: 2,
    payer_name: "Alice",
    reimbursed_by_id: null,
    booking_id: null,
    maintenance_id: null,
    settlement_id: null,
    date: Temporal.PlainDate.from("2026-01-15"),
    status: "submitted",
    receipt_url: null,
    expense_types: ["food", "gas"],
    ...overrides,
  }
}

describe("MyExpenseRow", () => {
  test("joins multiple categories with commas", () => {
    render(
      <MyExpenseRow
        expense={makeExpense()}
        deletePending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText("food, gas")).toBeInTheDocument()
  })

  test("falls back to '(no category)' when expense has no types", () => {
    render(
      <MyExpenseRow
        expense={makeExpense({ expense_types: [] })}
        deletePending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText("(no category)")).toBeInTheDocument()
  })

  test("shows the amount and status", () => {
    render(
      <MyExpenseRow
        expense={makeExpense({ amount: 123, status: "draft" })}
        deletePending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText("123")).toBeInTheDocument()
    expect(screen.getByText("draft")).toBeInTheDocument()
  })

  test("Edit / Delete buttons fire callbacks", async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <MyExpenseRow
        expense={makeExpense()}
        deletePending={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  test("disables both buttons while deletePending", () => {
    render(
      <MyExpenseRow
        expense={makeExpense()}
        deletePending={true}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })
})
