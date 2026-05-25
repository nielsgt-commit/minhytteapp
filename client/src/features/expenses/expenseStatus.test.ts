import { describe, expect, test } from "vitest"
import { STATUS_COLOR, STATUS_ORDER, type Status } from "./expenseStatus.ts"

describe("STATUS_ORDER", () => {
  test("orders draft < submitted < reimbursed < rejected", () => {
    expect(STATUS_ORDER.draft).toBeLessThan(STATUS_ORDER.submitted)
    expect(STATUS_ORDER.submitted).toBeLessThan(STATUS_ORDER.reimbursed)
    expect(STATUS_ORDER.reimbursed).toBeLessThan(STATUS_ORDER.rejected)
  })

  test("has a unique number for every status", () => {
    const values = Object.values(STATUS_ORDER)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe("STATUS_COLOR", () => {
  test("maps each status to a token color", () => {
    const expected: Record<Status, string> = {
      draft: "neutral",
      submitted: "info",
      reimbursed: "success",
      rejected: "danger",
    }
    for (const key of Object.keys(expected) as Status[]) {
      expect(STATUS_COLOR[key]).toBe(expected[key])
    }
  })
})
