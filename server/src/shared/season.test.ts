import { describe, expect, it } from "vitest"
import { isCrossYear, isValidMonthDay, normalizeWeeks } from "./season.ts"

describe("isValidMonthDay", () => {
  it("accepts ordinary dates", () => {
    expect(isValidMonthDay(1, 1)).toBe(true)
    expect(isValidMonthDay(12, 31)).toBe(true)
    expect(isValidMonthDay(6, 30)).toBe(true)
  })

  it("accepts Feb 29 (leap-permissive; constrained client-side)", () => {
    expect(isValidMonthDay(2, 29)).toBe(true)
  })

  it("rejects days that never exist in the month", () => {
    expect(isValidMonthDay(2, 30)).toBe(false)
    expect(isValidMonthDay(4, 31)).toBe(false)
    expect(isValidMonthDay(6, 31)).toBe(false)
  })

  it("rejects out-of-range months and days", () => {
    expect(isValidMonthDay(0, 1)).toBe(false)
    expect(isValidMonthDay(13, 1)).toBe(false)
    expect(isValidMonthDay(5, 0)).toBe(false)
    expect(isValidMonthDay(5, 32)).toBe(false)
    expect(isValidMonthDay(1.5, 1)).toBe(false)
    expect(isValidMonthDay(1, 1.5)).toBe(false)
  })
})

describe("isCrossYear", () => {
  const season = (
    start_month: number,
    start_day: number,
    end_month: number,
    end_day: number,
  ) => ({ start_month, start_day, end_month, end_day })

  it("summer-style ranges stay within the year", () => {
    expect(isCrossYear(season(6, 1, 8, 31))).toBe(false)
  })

  it("winter-style ranges wrap", () => {
    expect(isCrossYear(season(12, 1, 2, 28))).toBe(true)
  })

  it("same month compares by day", () => {
    expect(isCrossYear(season(6, 15, 6, 1))).toBe(true)
    expect(isCrossYear(season(6, 1, 6, 15))).toBe(false)
    expect(isCrossYear(season(6, 1, 6, 1))).toBe(false)
  })
})

describe("normalizeWeeks", () => {
  it("dedupes and sorts ascending", () => {
    expect(normalizeWeeks([30, 28, 29, 28])).toEqual([28, 29, 30])
  })

  it("passes an empty list through", () => {
    expect(normalizeWeeks([])).toEqual([])
  })
})
