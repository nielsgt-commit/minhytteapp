import { describe, expect, test } from "vitest"
import { Temporal } from "temporal-polyfill"
import {
  selectApprovedExpenses,
  selectExpensesToReview,
  selectMyExpenses,
} from "./selectors.ts"
import type { ExpenseRow, Status } from "./types.ts"

const pd = (iso: string) => Temporal.PlainDate.from(iso)

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: 1,
    property_id: 10,
    description: "x",
    amount: 1,
    payer_id: 2,
    payer_name: "Alice",
    reimbursed_by_id: null,
    booking_id: null,
    maintenance_id: null,
    settlement_id: null,
    date: pd("2026-01-15"),
    receipt_date: pd("2026-01-15"),
    status: "submitted",
    receipt_url: null,
    expense_types: [],
    ...overrides,
  }
}

describe("selectExpensesToReview", () => {
  const members = new Set([2, 3, 4])
  const reviewer = 3

  test("keeps only submitted expenses from group members other than the reviewer", () => {
    const expenses = [
      makeExpense({ id: 1, payer_id: 2, status: "submitted" }),
      makeExpense({ id: 2, payer_id: 3, status: "submitted" }), // reviewer self
      makeExpense({ id: 3, payer_id: 99, status: "submitted" }), // outsider
      makeExpense({ id: 4, payer_id: 4, status: "draft" }), // not submitted
      makeExpense({ id: 5, payer_id: 4, status: "submitted" }),
    ]
    const ids = selectExpensesToReview(expenses, members, reviewer).map(
      e => e.id,
    )
    expect(ids).toEqual([1, 5])
  })

  test("sorts by date ascending", () => {
    const expenses = [
      makeExpense({ id: 1, payer_id: 2, date: pd("2026-03-01") }),
      makeExpense({ id: 2, payer_id: 4, date: pd("2026-01-01") }),
      makeExpense({ id: 3, payer_id: 2, date: pd("2026-02-01") }),
    ]
    const dates = selectExpensesToReview(expenses, members, reviewer).map(e =>
      e.date.toString(),
    )
    expect(dates).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"])
  })

  test("does not mutate the input array", () => {
    const expenses = [
      makeExpense({ id: 1, payer_id: 2, date: pd("2026-03-01") }),
      makeExpense({ id: 2, payer_id: 4, date: pd("2026-01-01") }),
    ]
    const before = expenses.map(e => e.id)
    selectExpensesToReview(expenses, members, reviewer)
    expect(expenses.map(e => e.id)).toEqual(before)
  })
})

describe("selectApprovedExpenses", () => {
  const members = new Set([2, 3])

  test("keeps only reimbursed expenses from group members", () => {
    const expenses = [
      makeExpense({ id: 1, payer_id: 2, status: "reimbursed" }),
      makeExpense({ id: 2, payer_id: 2, status: "submitted" }),
      makeExpense({ id: 3, payer_id: 99, status: "reimbursed" }), // outsider
      makeExpense({ id: 4, payer_id: 3, status: "rejected" }),
      makeExpense({ id: 5, payer_id: 3, status: "reimbursed" }),
    ]
    const ids = selectApprovedExpenses(expenses, members).map(e => e.id)
    expect(ids).toEqual([1, 5])
  })

  test("sorts by date ascending", () => {
    const expenses = [
      makeExpense({
        id: 1,
        payer_id: 2,
        status: "reimbursed",
        date: pd("2026-03-01"),
      }),
      makeExpense({
        id: 2,
        payer_id: 3,
        status: "reimbursed",
        date: pd("2026-01-01"),
      }),
    ]
    expect(selectApprovedExpenses(expenses, members).map(e => e.id)).toEqual([
      2, 1,
    ])
  })
})

describe("selectMyExpenses", () => {
  test("keeps only expenses paid by me", () => {
    const expenses = [
      makeExpense({ id: 1, payer_id: 7 }),
      makeExpense({ id: 2, payer_id: 8 }),
      makeExpense({ id: 3, payer_id: 7 }),
    ]
    const ids = selectMyExpenses(expenses, 7).map(e => e.id)
    expect(ids).toEqual([1, 3])
  })

  test("sorts by STATUS_ORDER then by date ascending", () => {
    const statuses: Status[] = ["rejected", "draft", "submitted", "reimbursed"]
    const expenses = statuses.map((s, i) =>
      makeExpense({
        id: i + 1,
        payer_id: 7,
        status: s,
        date: pd("2026-01-01"),
      }),
    )
    const order = selectMyExpenses(expenses, 7).map(e => e.status)
    expect(order).toEqual(["draft", "submitted", "reimbursed", "rejected"])
  })

  test("within the same status, earlier date comes first", () => {
    const expenses = [
      makeExpense({
        id: 1,
        payer_id: 7,
        status: "draft",
        date: pd("2026-02-01"),
      }),
      makeExpense({
        id: 2,
        payer_id: 7,
        status: "draft",
        date: pd("2026-01-01"),
      }),
    ]
    expect(selectMyExpenses(expenses, 7).map(e => e.id)).toEqual([2, 1])
  })
})
