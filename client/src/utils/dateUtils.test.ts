import { Temporal } from "temporal-polyfill"
import { describe, expect, test } from "vitest"
import {
  formatDate,
  formatDateRange,
  formatDayMonth,
  inclusiveDayCount,
  isoWeekMonday,
  isoWeekNumber,
  isoWeekYear,
  startOfSunday,
  toDateInputValue,
} from "./dateUtils.ts"

const pd = (iso: string) => Temporal.PlainDate.from(iso)

describe("formatDayMonth", () => {
  test("zero-pads day and month", () => {
    expect(formatDayMonth(pd("2026-01-05"))).toBe("05/01")
  })

  test("keeps two-digit values", () => {
    expect(formatDayMonth(pd("2026-11-23"))).toBe("23/11")
  })
})

describe("startOfSunday", () => {
  test("returns the same day when called on Sunday", () => {
    expect(startOfSunday(pd("2026-01-04")).toString()).toBe("2026-01-04")
  })

  test("snaps a midweek date back to the prior Sunday", () => {
    expect(startOfSunday(pd("2026-01-07")).toString()).toBe("2026-01-04")
  })
})

describe("isoWeekNumber / isoWeekYear", () => {
  // ISO week edge case: 2027-01-01 (Friday) belongs to week 53 of 2026.
  test("Jan 1 2027 is week 53 of ISO year 2026", () => {
    const d = pd("2027-01-01")
    expect(isoWeekNumber(d)).toBe(53)
    expect(isoWeekYear(d)).toBe(2026)
  })

  test("mid-year week", () => {
    const d = pd("2026-07-15")
    expect(isoWeekNumber(d)).toBe(29)
    expect(isoWeekYear(d)).toBe(2026)
  })
})

describe("formatDate", () => {
  test("formats a PlainDate for the given locale", () => {
    expect(formatDate(pd("2026-01-05"), "en-GB")).toBe("05/01/2026")
  })

  test("formats with Norwegian locale", () => {
    expect(formatDate(pd("2026-01-05"), "nb-NO")).toBe("5.1.2026")
  })

  test("formats an Instant as its Oslo local day", () => {
    const i = Temporal.Instant.from("2026-01-05T12:00:00Z")
    expect(formatDate(i, "en-GB")).toBe("05/01/2026")
  })

  test("returns empty string for null/undefined", () => {
    expect(formatDate(null, "en-GB")).toBe("")
    expect(formatDate(undefined, "en-GB")).toBe("")
  })
})

describe("formatDateRange", () => {
  const start = pd("2026-01-05")
  const end = pd("2026-01-09")

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
    expect(formatDateRange(start, pd("2026-01-05"), "en-GB")).toBe(
      "05/01/2026",
    )
  })

  test("returns empty string when both ends are missing", () => {
    expect(formatDateRange(null, undefined, "en-GB")).toBe("")
  })
})

describe("toDateInputValue", () => {
  test("PlainDate becomes its ISO string", () => {
    expect(toDateInputValue(pd("2026-01-05"))).toBe("2026-01-05")
  })

  test("Instant becomes its Oslo local day", () => {
    // 23:30Z on Jan 5 is already Jan 6 in Oslo (UTC+1).
    const i = Temporal.Instant.from("2026-01-05T23:30:00Z")
    expect(toDateInputValue(i)).toBe("2026-01-06")
  })

  test("returns empty string for null/undefined", () => {
    expect(toDateInputValue(null)).toBe("")
    expect(toDateInputValue(undefined)).toBe("")
  })
})

describe("inclusiveDayCount", () => {
  test("Jul 6 -> Jul 12 is 7 days", () => {
    expect(inclusiveDayCount(pd("2026-07-06"), pd("2026-07-12"))).toBe(7)
  })

  test("same day counts as 1", () => {
    expect(inclusiveDayCount(pd("2026-07-06"), pd("2026-07-06"))).toBe(1)
  })
})

describe("isoWeekMonday", () => {
  test("returns the Monday of the requested ISO week", () => {
    const d = isoWeekMonday(2026, 29)
    expect(d.dayOfWeek).toBe(1)
    expect(d.toString()).toBe("2026-07-13")
  })

  test("round-trips with isoWeekNumber", () => {
    const monday = isoWeekMonday(2026, 1)
    expect(isoWeekNumber(monday)).toBe(1)
    expect(isoWeekYear(monday)).toBe(2026)
  })
})
