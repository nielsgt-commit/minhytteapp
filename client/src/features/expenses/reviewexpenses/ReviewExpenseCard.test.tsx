import { Temporal } from "temporal-polyfill"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { ReviewExpenseCard } from "./ReviewExpenseCard.tsx"
import type { ExpenseRow } from "../types.ts"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: 1,
    property_id: 10,
    description: "Coffee",
    amount: 99,
    payer_id: 2,
    payer_name: "Alice",
    reimbursed_by_id: null,
    booking_id: null,
    maintenance_id: null,
    settlement_id: null,
    date: Temporal.PlainDate.from("2026-01-15"),
    receipt_date: Temporal.PlainDate.from("2026-01-15"),
    status: "submitted",
    receipt_url: null,
    expense_types: ["food"],
    ...overrides,
  }
}

describe("ReviewExpenseCard", () => {
  test("displays the first category, amount, and payer name", () => {
    render(
      <ReviewExpenseCard
        expense={makeExpense()}
        pending={false}
        onReimburse={() => {}}
        onReject={() => {}}
      />,
    )
    expect(screen.getByText("food")).toBeInTheDocument()
    expect(screen.getByText("99")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
  })

  test("falls back to '(no category)' and '#id' label when fields are missing", () => {
    render(
      <ReviewExpenseCard
        expense={makeExpense({
          expense_types: [],
          payer_name: null,
          payer_id: 42,
        })}
        pending={false}
        onReimburse={() => {}}
        onReject={() => {}}
      />,
    )
    expect(screen.getByText("(no category)")).toBeInTheDocument()
    expect(screen.getByText("#42")).toBeInTheDocument()
  })

  test("hides the receipt trigger when receipt_url is null", () => {
    render(
      <ReviewExpenseCard
        expense={makeExpense({ receipt_url: null })}
        pending={false}
        onReimburse={() => {}}
        onReject={() => {}}
      />,
    )
    expect(
      screen.queryByRole("button", { name: "View receipt" }),
    ).not.toBeInTheDocument()
  })

  test("Reimburse and Reject buttons fire callbacks with the expense", async () => {
    const onReimburse = vi.fn()
    const onReject = vi.fn()
    const expense = makeExpense()
    const user = userEvent.setup()
    render(
      <ReviewExpenseCard
        expense={expense}
        pending={false}
        onReimburse={onReimburse}
        onReject={onReject}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Approve and mark as reimbursed" }),
    )
    await user.click(screen.getByRole("button", { name: "Reject" }))
    expect(onReimburse).toHaveBeenCalledWith(expense)
    expect(onReject).toHaveBeenCalledWith(expense)
  })

  test("disables both action buttons when pending", () => {
    render(
      <ReviewExpenseCard
        expense={makeExpense()}
        pending={true}
        onReimburse={() => {}}
        onReject={() => {}}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Approve and mark as reimbursed" }),
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled()
  })
})
