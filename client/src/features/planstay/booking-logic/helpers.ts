// ============================================================
// Pure helpers for the calendar booking flow.
// ============================================================

// ---- Date utilities ----

import { Temporal } from "temporal-polyfill"

export function fromIso(iso: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(iso)
}

/**
 * Expand a start_date..end_date range into an array of ISO date strings,
 * inclusive on both ends. Returns strings on purpose: the booking-draft
 * reducer and `dotsByDay` Map stay string-keyed (PlainDate is an object,
 * so value-keyed Map lookups would break).
 */
export function expandRange(start_date: string, end_date: string): string[] {
  const result: string[] = []
  let cur = fromIso(start_date)
  const end = fromIso(end_date)
  while (Temporal.PlainDate.compare(cur, end) <= 0) {
    result.push(cur.toString())
    cur = cur.add({ days: 1 })
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
    const expected = fromIso(cur.end).add({ days: 1 }).toString()
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

export function sundayBeforeIsoWeek(
  year: number,
  week: number,
): Temporal.PlainDate {
  // Jan-4 arithmetic — Temporal.PlainDate.from() rejects week fields.
  const jan4 = Temporal.PlainDate.from({ year, month: 1, day: 4 })
  const monday = jan4
    .subtract({ days: jan4.dayOfWeek - 1 })
    .add({ weeks: week - 1 })
  return monday.subtract({ days: 1 })
}
