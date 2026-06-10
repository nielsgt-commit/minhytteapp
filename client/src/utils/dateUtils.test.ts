import { describe, expect, test } from "vitest"
import {
  addDays,
  currentYear,
  formatDate,
  formatDateRange,
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

describe("formatDate", () => {
  test("formats a Date for the given locale", () => {
    expect(formatDate(new Date(2026, 0, 5), "en-GB")).toBe("05/01/2026")
  })

  test("formats with Norwegian locale", () => {
    expect(formatDate(new Date(2026, 0, 5), "nb-NO")).toBe("5.1.2026")
  })

  test("accepts a parseable string", () => {
    expect(formatDate("2026-01-05T12:00:00", "en-GB")).toBe("05/01/2026")
  })

  test("returns empty string for null/undefined", () => {
    expect(formatDate(null, "en-GB")).toBe("")
    expect(formatDate(undefined, "en-GB")).toBe("")
  })

  test("returns empty string for invalid input", () => {
    expect(formatDate("not a date", "en-GB")).toBe("")
  })
})

describe("formatDateRange", () => {
  const start = new Date(2026, 0, 5)
  const end = new Date(2026, 0, 9)

  test("joins both ends with an en dash", () => {
    expect(formatDateRange(start, end, "en-GB")).toBe("05/01/2026 – 09/01/2026")
  })

  test("returns only start when end is missing", () => {
    expect(formatDateRange(start, null, "en-GB")).toBe("05/01/2026")
  })

  test("returns only end when start is missing", () => {
    expect(formatDateRange(null, end, "en-GB")).toBe("09/01/2026")
  })

  test("collapses identical ends to a single date", () => {
    expect(formatDateRange(start, new Date(2026, 0, 5), "en-GB")).toBe(
      "05/01/2026",
    )
  })

  test("returns empty string when both ends are missing", () => {
    expect(formatDateRange(null, undefined, "en-GB")).toBe("")
  })
})

describe("currentYear", () => {
  test("matches the system clock's year", () => {
    expect(currentYear()).toBe(new Date().getFullYear())
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
