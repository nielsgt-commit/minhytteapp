export function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function toIso(d: Date): string {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// Format a date (or parseable string) as the local-day `YYYY-MM-DD` value an
// <input type="date"> expects. Local-time on purpose: a calendar due date is a
// human "which day", not a UTC instant. Returns "" for null/invalid input.
export function toDateInputValue(
  value: string | Date | null | undefined,
): string {
  if (value == null) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return toIso(d)
}

// Locale-aware display of a date (or parseable string). Returns "" for
// null/invalid input, mirroring toDateInputValue.
export function formatDate(
  value: string | Date | null | undefined,
  locale: string,
): string {
  if (value == null) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(locale)
}

export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  locale: string,
): string {
  const a = formatDate(start, locale)
  const b = formatDate(end, locale)
  if (!a) return b
  if (!b || a === b) return a
  return `${a} – ${b}`
}

export function currentYear(): number {
  return new Date().getFullYear()
}

// Inclusive day count between two `YYYY-MM-DD` dates: Jul 6 -> Jul 12 = 7 days.
export function inclusiveDayCount(startIso: string, endIso: string): number {
  const s = Date.parse(`${startIso}T00:00:00Z`)
  const e = Date.parse(`${endIso}T00:00:00Z`)
  return Math.round((e - s) / 86400000) + 1
}

export function startOfSunday(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function isoWeekYear(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  return t.getUTCFullYear()
}

export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1))
  const target = new Date(week1Monday)
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return target
}
