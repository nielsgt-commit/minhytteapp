import { describe, expect, test } from "vitest"
import {
  addDays,
  isoWeekMonday,
  isoWeekNumber,
  isoWeekYear,
  pad2,
  startOfSunday,
  toIso,
} from "./dateUtils.ts"

describe("pad2", () => {
  test("pads single digit", () => {
    expect(pad2(3)).toBe("03")
  })

  test("leaves two digits unchanged", () => {
    expect(pad2(42)).toBe("42")
  })
})

describe("toIso", () => {
  test("formats local date as YYYY-MM-DD with zero-padding", () => {
    expect(toIso(new Date(2026, 0, 5))).toBe("2026-01-05")
  })
})

describe("addDays", () => {
  test("crosses month boundary", () => {
    expect(toIso(addDays(new Date(2026, 0, 30), 3))).toBe("2026-02-02")
  })

  test("negative offset", () => {
    expect(toIso(addDays(new Date(2026, 2, 1), -1))).toBe("2026-02-28")
  })

  test("does not mutate input", () => {
    const d = new Date(2026, 0, 1)
    addDays(d, 5)
    expect(d.getDate()).toBe(1)
  })
})

describe("startOfSunday", () => {
  test("returns the same day when called on Sunday", () => {
    const sun = new Date(2026, 0, 4) // Sunday
    expect(toIso(startOfSunday(sun))).toBe("2026-01-04")
  })

  test("snaps a midweek date back to the prior Sunday", () => {
    const wed = new Date(2026, 0, 7) // Wednesday
    expect(toIso(startOfSunday(wed))).toBe("2026-01-04")
  })

  test("zeroes the time component", () => {
    const d = startOfSunday(new Date(2026, 0, 7, 15, 42))
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })
})

describe("isoWeekNumber / isoWeekYear", () => {
  // ISO week edge case: 2027-01-01 (Friday) belongs to week 53 of 2026.
  test("Jan 1 2027 is week 53 of ISO year 2026", () => {
    const d = new Date(2027, 0, 1)
    expect(isoWeekNumber(d)).toBe(53)
    expect(isoWeekYear(d)).toBe(2026)
  })

  test("mid-year week", () => {
    const d = new Date(2026, 6, 15) // 15 July 2026
    expect(isoWeekNumber(d)).toBe(29)
    expect(isoWeekYear(d)).toBe(2026)
  })
})

describe("isoWeekMonday", () => {
  test("returns the Monday of the requested ISO week", () => {
    const d = isoWeekMonday(2026, 29)
    expect(d.getUTCDay()).toBe(1)
    expect(d.toISOString().slice(0, 10)).toBe("2026-07-13")
  })

  test("round-trips with isoWeekNumber", () => {
    const monday = isoWeekMonday(2026, 1)
    expect(isoWeekNumber(monday)).toBe(1)
    expect(isoWeekYear(monday)).toBe(2026)
  })
})
