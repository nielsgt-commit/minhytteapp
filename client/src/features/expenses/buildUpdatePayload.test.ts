import { describe, expect, test } from "vitest"
import { basePayload, toUpdateInput } from "./buildUpdatePayload.ts"
import type { ExpenseRow } from "./types.ts"

const baseExpense: ExpenseRow = {
  id: 1,
  property_id: 10,
  description: "Coffee",
  amount: 50,
  payer_id: 2,
  payer_name: "Alice",
  reimbursed_by_id: null,
  booking_id: null,
  maintenance_id: null,
  settlement_id: null,
  date: "2026-01-15",
  status: "submitted",
  receipt_url: null,
  expense_types: ["food"],
}

describe("basePayload", () => {
  test("includes core fields and converts nulls to undefined for FK ids", () => {
    expect(basePayload(baseExpense, 99)).toEqual({
      id: 1,
      property_id: 10,
      description: "Coffee",
      amount: 50,
      booking_id: undefined,
      maintenance_id: undefined,
      date: "2026-01-15",
      receipt_url: null,
      expense_types: ["food"],
    })
  })

  test("uses fallbackPropertyId when property_id is null", () => {
    const result = basePayload({ ...baseExpense, property_id: null }, 99)
    expect(result.property_id).toBe(99)
  })
})

describe("toUpdateInput", () => {
  test("applies overrides over original values", () => {
    const result = toUpdateInput(baseExpense, 99, {
      description: "Tea",
      amount: 75,
      date: "2026-02-01",
      status: "reimbursed",
    })
    expect(result).toMatchObject({
      description: "Tea",
      amount: 75,
      date: "2026-02-01",
      status: "reimbursed",
    })
  })

  test("falls back to existing values when overrides are omitted", () => {
    const result = toUpdateInput(baseExpense, 99, { status: "submitted" })
    expect(result.description).toBe("Coffee")
    expect(result.amount).toBe(50)
    expect(result.date).toBe("2026-01-15")
  })

  test("preserves settlement_id when override is undefined, overrides when explicit (including null)", () => {
    const withSettlement: ExpenseRow = { ...baseExpense, settlement_id: 7 }
    expect(
      toUpdateInput(withSettlement, 99, { status: "submitted" }).settlement_id,
    ).toBe(7)
    expect(
      toUpdateInput(withSettlement, 99, {
        status: "submitted",
        settlement_id: null,
      }).settlement_id,
    ).toBeNull()
    expect(
      toUpdateInput(baseExpense, 99, {
        status: "submitted",
        settlement_id: 42,
      }).settlement_id,
    ).toBe(42)
  })

  test("uses fallbackPropertyId when property_id is null", () => {
    const result = toUpdateInput(
      { ...baseExpense, property_id: null },
      77,
      { status: "submitted" },
    )
    expect(result.property_id).toBe(77)
  })
})
