// Single source of truth for "who occupies the property on a given day" and
// how that maps to bed availability. The dashboard day cards and the
// available-beds card (client, via the @server alias) both count through
// here so the two can never drift apart again.

import type { Temporal } from "temporal-polyfill"

export type BookingStatus = "pending" | "confirmed" | "cancelled"

// A pending stay still occupies: a bed someone may claim is not available.
export const OCCUPYING_STATUSES: readonly BookingStatus[] = [
  "pending",
  "confirmed",
]

export function isOccupying(status: string): boolean {
  return OCCUPYING_STATUSES.includes(status as BookingStatus)
}

// Virtual "Tent" room for sleeps-separately occupants. Real room ids are
// serial (positive), so -1 can never collide. The tent holds no real beds and
// never reaches capacity/availability math — it only groups tent sleepers in
// room pickers and day cards.
export const TENT_ROOM_ID = -1
export const TENT_CAPACITY = 10

export type OccupancyOccupant = {
  user_id: number
  room_id: number | null
  queued?: boolean
  sleeps_separately?: boolean
}

// A named non-user visitor. Guests belong to exactly one booking, share its
// status, and can never be queued — they always occupy when the booking does.
export type OccupancyGuest = {
  guest_id: number
  room_id: number | null
  sleeps_separately?: boolean
}

export type OccupancyBooking<
  O extends OccupancyOccupant = OccupancyOccupant,
  G extends OccupancyGuest = OccupancyGuest,
> = {
  status: string
  start_date: Temporal.PlainDate
  end_date: Temporal.PlainDate
  occupants: readonly O[]
  guests?: readonly G[]
}

// end_date is inclusive: the booking occupies [start_date, end_date].
export function bookingCoversDay(
  b: { start_date: Temporal.PlainDate; end_date: Temporal.PlainDate },
  iso: string,
): boolean {
  return iso >= b.start_date.toString() && iso <= b.end_date.toString()
}

export type StayFilter = {
  statuses: readonly BookingStatus[]
  includeQueued: boolean
}

// The day cards count queued (waitlisted) occupants as guests; bed
// availability never lets them hold a bed.
export const GUEST_FILTER: StayFilter = {
  statuses: OCCUPYING_STATUSES,
  includeQueued: true,
}
export const BED_FILTER: StayFilter = {
  statuses: OCCUPYING_STATUSES,
  includeQueued: false,
}

// Everyone at the property on `iso`, one entry per person. When overlapping
// bookings both hold a person, the entry with a room assignment wins.
export function occupantsOnDay<O extends OccupancyOccupant>(
  bookings: readonly OccupancyBooking<O>[],
  iso: string,
  filter: StayFilter,
): O[] {
  const byUser = new Map<number, O>()
  for (const b of bookings) {
    if (!filter.statuses.includes(b.status as BookingStatus)) continue
    if (!bookingCoversDay(b, iso)) continue
    for (const o of b.occupants) {
      if (o.queued === true && !filter.includeQueued) continue
      const prev = byUser.get(o.user_id)
      if (!prev || (prev.room_id == null && o.room_id != null)) {
        byUser.set(o.user_id, o)
      }
    }
  }
  return [...byUser.values()]
}

// Guests at the property on `iso`. No dedupe: a guest row exists on exactly
// one booking, so overlapping bookings can never hold the same guest twice.
export function guestsOnDay<G extends OccupancyGuest>(
  bookings: readonly OccupancyBooking<OccupancyOccupant, G>[],
  iso: string,
  filter: StayFilter,
): G[] {
  const out: G[] = []
  for (const b of bookings) {
    if (!filter.statuses.includes(b.status as BookingStatus)) continue
    if (!bookingCoversDay(b, iso)) continue
    for (const g of b.guests ?? []) out.push(g)
  }
  return out
}

export type BedCounts = {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

/** Total person-slots a room can hold (beds_double counts 2 slots). */
export function roomTotalCapacity(room: BedCounts): number {
  return (
    room.travel_cot +
    room.beds_kid +
    room.beds_sm +
    room.beds_lg +
    room.beds_double * 2 +
    room.mattresses
  )
}

export type AvailabilityRoom = BedCounts & {
  id: number
  name: string
  structure_id: number
  structure_name: string | null
  structure_category: string | null
}

export type RoomAvailability = {
  room_id: number
  name: string
  structure_id: number
  structure_name: string | null
  capacity: number
  occupied: number
  available: number
}

// Beds exist only in habitable structures. Queued occupants hold no bed;
// sleeps-separately occupants (own tent) hold no bed and aren't "without a
// room" either. A guest assigned to a room outside the habitable list counts
// as unassigned rather than silently disappearing.
export function bedAvailabilityForDay(
  rooms: readonly AvailabilityRoom[],
  bookings: readonly OccupancyBooking[],
  iso: string,
): { rooms: RoomAvailability[]; unassignedGuests: number } {
  const habitable = rooms.filter(r => r.structure_category === "habitable")
  const habitableIds = new Set(habitable.map(r => r.id))

  const occupiedByRoom = new Map<number, number>()
  let unassignedGuests = 0
  const persons: { room_id: number | null; sleeps_separately?: boolean }[] = [
    ...occupantsOnDay(bookings, iso, BED_FILTER),
    ...guestsOnDay(bookings, iso, BED_FILTER),
  ]
  for (const o of persons) {
    if (o.sleeps_separately === true) continue
    if (o.room_id != null && habitableIds.has(o.room_id)) {
      occupiedByRoom.set(o.room_id, (occupiedByRoom.get(o.room_id) ?? 0) + 1)
    } else {
      unassignedGuests += 1
    }
  }

  return {
    unassignedGuests,
    rooms: habitable.map(r => {
      const capacity = roomTotalCapacity(r)
      const occupied = occupiedByRoom.get(r.id) ?? 0
      return {
        room_id: r.id,
        name: r.name,
        structure_id: r.structure_id,
        structure_name: r.structure_name,
        capacity,
        occupied,
        available: Math.max(0, capacity - occupied),
      }
    }),
  }
}
