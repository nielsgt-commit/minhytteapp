// ============================================================
// Pure helpers for the calendar booking flow.
// ============================================================

// ---- Date utilities ----

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function toIso(d: Date): string {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function fromIso(iso: string): Date {
  const parts = iso.split("-").map(Number)
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!)
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/**
 * Expand a start_date..end_date range into an array of ISO date strings,
 * inclusive on both ends.
 */
export function expandRange(start_date: string, end_date: string): string[] {
  const result: string[] = []
  let cur = fromIso(start_date)
  const end = fromIso(end_date)
  while (cur <= end) {
    result.push(toIso(cur))
    cur = addDays(cur, 1)
  }
  return result
}

export function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export type Range = { start: string; end: string; days: string[] }

/**
 * Group an array of ISO date strings into consecutive ranges.
 * Lifted from ExperimentalWeekPanel.tsx.
 */
export function groupConsecutive(isos: string[]): Range[] {
  const sorted = [...new Set(isos)].sort()
  if (sorted.length === 0) return []
  const out: Range[] = []
  let cur: Range = { start: sorted[0]!, end: sorted[0]!, days: [sorted[0]!] }
  for (let i = 1; i < sorted.length; i++) {
    const iso = sorted[i]!
    const expected = toIso(addDays(fromIso(cur.end), 1))
    if (iso === expected) {
      cur.end = iso
      cur.days.push(iso)
    } else {
      out.push(cur)
      cur = { start: iso, end: iso, days: [iso] }
    }
  }
  out.push(cur)
  return out
}

// ---- Capacity helpers ----

type BedCounts = {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

/**
 * Total person-slots a room can hold.
 * beds_double counts as 2 slots.
 */
export function bedCapacity(room: BedCounts): number {
  return (
    room.travel_cot
    + room.beds_kid
    + room.beds_sm
    + room.beds_lg
    + room.beds_double * 2
    + room.mattresses
  )
}

type RoomRow = BedCounts & { building_id: number }
type BuildingRow = { id: number; category: string }

/**
 * Total person-capacity across habitable rooms for a property.
 */
export function propertyCapacity(
  rooms: RoomRow[],
  buildings: BuildingRow[],
): number {
  const habitableBuildingIds = new Set(
    buildings
      .filter(b => b.category === "habitable")
      .map(b => b.id),
  )
  return rooms
    .filter(r => habitableBuildingIds.has(r.building_id))
    .reduce((sum, r) => sum + bedCapacity(r), 0)
}

// ---- Sunday before ISO week (from ExperimentalWeekPanel) ----

export function sundayBeforeIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay()
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() - 1)
  sunday.setHours(0, 0, 0, 0)
  return sunday
}
