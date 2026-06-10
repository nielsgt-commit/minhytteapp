// ============================================================
// Pure helpers for the calendar booking flow.
// ============================================================

// ---- Date utilities ----

import { addDays, toIso } from "@/utils/dateUtils"

// Re-export the shared local-time date helpers so this module keeps its
// historical import surface (`booking-logic` exposes toIso/addDays/…).
export { addDays, isoWeekNumber, toIso } from "@/utils/dateUtils"

export function fromIso(iso: string): Date {
  const parts = iso.split("-").map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
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

export type Range = { start: string; end: string; days: string[] }

/**
 * Group an array of ISO date strings into consecutive ranges.
 * Lifted from ExperimentalWeekPanel.tsx.
 */
export function groupConsecutive(isos: string[]): Range[] {
  const sorted = [...new Set(isos)].sort()
  if (sorted.length === 0) return []
  const out: Range[] = []
  let cur: Range = { start: sorted[0], end: sorted[0], days: [sorted[0]] }
  for (let i = 1; i < sorted.length; i++) {
    const iso = sorted[i]
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
    room.travel_cot +
    room.beds_kid +
    room.beds_sm +
    room.beds_lg +
    room.beds_double * 2 +
    room.mattresses
  )
}

type RoomRow = BedCounts & { structure_id: number }
type StructureRow = { id: number; category: string }

/**
 * Total person-capacity across habitable rooms for a property.
 */
export function propertyCapacity(
  rooms: RoomRow[],
  structures: StructureRow[],
): number {
  const habitableBuildingIds = new Set(
    structures.filter(b => b.category === "habitable").map(b => b.id),
  )
  return rooms
    .filter(r => habitableBuildingIds.has(r.structure_id))
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
