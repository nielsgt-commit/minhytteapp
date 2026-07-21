import { Temporal } from "temporal-polyfill"

// All cabin dates are human "which day" values in Norway; instants are
// rendered as their Oslo local day.
const OSLO = "Europe/Oslo"

type DateLike = Temporal.PlainDate | Temporal.Instant | null | undefined

function toPlainDate(value: Temporal.PlainDate | Temporal.Instant) {
  return value instanceof Temporal.Instant
    ? value.toZonedDateTimeISO(OSLO).toPlainDate()
    : value
}

// The local-day `YYYY-MM-DD` value an <input type="date"> expects.
// Oslo-local on purpose: a calendar due date is a human "which day", not a
// UTC instant. Returns "" for null/undefined.
export function toDateInputValue(value: DateLike): string {
  if (value == null) return ""
  return toPlainDate(value).toString()
}

// Locale-aware display of a calendar day or instant (shown as its Oslo
// day). Returns "" for null/undefined, mirroring toDateInputValue.
export function formatDate(value: DateLike, locale: string): string {
  if (value == null) return ""
  return toPlainDate(value).toLocaleString(locale)
}

// Locale-aware "date, hh:mm" display of an instant in Oslo time, for
// "last updated" style stamps where the clock time matters.
export function formatDateTime(
  value: Temporal.Instant | null | undefined,
  locale: string,
): string {
  if (value == null) return ""
  return value.toZonedDateTimeISO(OSLO).toLocaleString(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateRange(
  start: DateLike,
  end: DateLike,
  locale: string,
): string {
  const a = formatDate(start, locale)
  const b = formatDate(end, locale)
  if (!a) return b
  if (!b || a === b) return a
  return `${a} – ${b}`
}

// Locale-aware "month year" label (e.g. "June 2026") for grouping headings.
export function formatMonthYear(
  pd: Temporal.PlainDate,
  locale: string,
): string {
  return pd.toLocaleString(locale, { year: "numeric", month: "long" })
}

// Fixed `dd/MM` for the calendar-grid day labels (format-stable across
// locales on purpose). Sliced from the ISO string so the zero-padding
// comes from Temporal itself.
export function formatDayMonth(pd: Temporal.PlainDate): string {
  const iso = pd.toString() // YYYY-MM-DD
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

// Inclusive day count: Jul 6 -> Jul 12 = 7 days.
export function inclusiveDayCount(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
): number {
  return start.until(end, { largestUnit: "days" }).days + 1
}

export function startOfSunday(pd: Temporal.PlainDate): Temporal.PlainDate {
  // dayOfWeek: Mon=1 … Sun=7; Sunday maps to 0 days back.
  return pd.subtract({ days: pd.dayOfWeek % 7 })
}

// weekOfYear/yearOfWeek are typed `number | undefined` per spec (calendars
// without well-defined weeks exist), but the ISO calendar — the only one we
// use — always yields a number. These narrow the type for callers.
export function isoWeekNumber(pd: Temporal.PlainDate): number {
  return requireWeekField(pd.weekOfYear)
}

export function isoWeekYear(pd: Temporal.PlainDate): number {
  return requireWeekField(pd.yearOfWeek)
}

function requireWeekField(n: number | undefined): number {
  if (n === undefined) {
    throw new Error("ISO calendar always defines week fields")
  }
  return n
}

export function isoWeekMonday(year: number, week: number): Temporal.PlainDate {
  // Temporal.PlainDate.from() rejects week fields as input, so keep the
  // classic Jan-4 arithmetic: Jan 4 is always in ISO week 1.
  const jan4 = Temporal.PlainDate.from({ year, month: 1, day: 4 })
  return jan4.subtract({ days: jan4.dayOfWeek - 1 }).add({ weeks: week - 1 })
}
