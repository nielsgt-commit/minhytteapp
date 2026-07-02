// Season helpers shared by the season router and its tests.
//
// A season is a recurring month+day range: it repeats every year, and a range
// whose end sorts before its start (e.g. Dec 1 – Feb 28) wraps the year
// boundary — the same convention split-policy custom ranges use.

// Maximum day per month, leap-permissive: Feb 29 is a valid *configuration*
// (it resolves to Feb 28 in common years via Temporal's overflow: "constrain").
export const MONTH_MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function isValidMonthDay(month: number, day: number): boolean {
  return (
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= (MONTH_MAX_DAY[month - 1] ?? 0)
  )
}

export function isCrossYear(s: {
  start_month: number
  start_day: number
  end_month: number
  end_day: number
}): boolean {
  return (
    s.end_month < s.start_month ||
    (s.end_month === s.start_month && s.end_day < s.start_day)
  )
}

// Dedupe and sort ascending; the stored array is always normalized so equality
// checks and adoption predicates never depend on input order.
export function normalizeWeeks(weeks: number[]): number[] {
  return [...new Set(weeks)].sort((a, b) => a - b)
}
