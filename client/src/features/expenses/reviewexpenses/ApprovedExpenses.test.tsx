import { Temporal } from "temporal-polyfill"
import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { ApprovedExpenses } from "./ApprovedExpenses.tsx"
import type { ExpenseRow } from "../types.ts"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}))

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: 1,
    property_id: 10,
    description: "Firewood delivery",
    amount: 480,
    payer_id: 2,
    payer_name: "Alice",
    reimbursed_by_id: null,
    booking_id: null,
    maintenance_id: null,
    settlement_id: null,
    date: Temporal.PlainDate.from("2026-01-15"),
    receipt_date: Temporal.PlainDate.from("2026-01-15"),
    status: "reimbursed",
    receipt_url: null,
    expense_types: ["firewood"],
    ...overrides,
  }
}

describe("ApprovedExpenses", () => {
  test("renders nothing when there are no approved expenses", () => {
    const { container } = render(<ApprovedExpenses expenses={[]} />)
    expect(container.firstChild).toBeNull()
  })

  test("lists category, description, payer, status and amount per expense", () => {
    render(
      <ApprovedExpenses
        expenses={[
          makeExpense(),
          makeExpense({
            id: 2,
            amount: 99,
            expense_types: [],
            description: "",
          }),
        ]}
      />,
    )
    expect(
      screen.getByText("Approved expenses ({{count}})"),
    ).toBeInTheDocument()
    expect(screen.getByText("firewood")).toBeInTheDocument()
    expect(screen.getByText("(no category)")).toBeInTheDocument()
    expect(screen.getByText("Firewood delivery")).toBeInTheDocument()
    expect(screen.getAllByText("Alice")).toHaveLength(2)
    expect(screen.getAllByText("reimbursed")).toHaveLength(2)
    expect(screen.getByText("480")).toBeInTheDocument()
  })
})
