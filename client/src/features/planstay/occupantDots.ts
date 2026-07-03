import { Temporal } from "temporal-polyfill"
import { BOOKING_MIN, BOOKING_MAX } from "./constants.ts"

type DotBooking = {
  id: number
  status: string
  start_date: Temporal.PlainDate
  end_date: Temporal.PlainDate
  occupants: {
    user_id: number
    parent_user_id: number | null
    queued: boolean
  }[]
}

type DotGroup = {
  id: number
  is_family: boolean
  members: { user_id: number }[]
}

/**
 * Build the calendar's per-day occupant dots: ISO date ("YYYY-MM-DD") → one
 * family-group id per person staying that night (0 = no family group). One
 * entry per occupant, so the dot count is the headcount. Bounded to the
 * pickers' bookable window so the map stays small. Cancelled bookings and
 * queued occupants are ignored.
 */
export function buildOccupantDots(
  bookings: DotBooking[],
  userGroups: DotGroup[],
  opts?: { excludeBookingId?: number },
): Map<string, number[]> {
  const familyGroupByUser = new Map<number, number>()
  for (const g of userGroups) {
    if (!g.is_family) continue
    // A user belongs to at most one family group per property.
    for (const m of g.members) familyGroupByUser.set(m.user_id, g.id)
  }

  const map = new Map<string, number[]>()
  for (const b of bookings) {
    if (b.status === "cancelled") continue
    if (opts?.excludeBookingId != null && b.id === opts.excludeBookingId)
      continue
    // Children aren't family-group members themselves — they inherit their
    // parent's group.
    const occGroups = b.occupants
      .filter(o => !o.queued)
      .map(
        o =>
          familyGroupByUser.get(o.user_id) ??
          (o.parent_user_id != null
            ? (familyGroupByUser.get(o.parent_user_id) ?? 0)
            : 0),
      )
    if (occGroups.length === 0) continue

    const startIso = b.start_date.toString()
    const endIso = b.end_date.toString()
    const start = startIso < BOOKING_MIN ? BOOKING_MIN : startIso
    const end = endIso > BOOKING_MAX ? BOOKING_MAX : endIso
    if (start > end) continue

    let cur = Temporal.PlainDate.from(start)
    const last = Temporal.PlainDate.from(end)
    while (Temporal.PlainDate.compare(cur, last) <= 0) {
      const iso = cur.toString()
      const list = map.get(iso)
      if (list) list.push(...occGroups)
      else map.set(iso, [...occGroups])
      cur = cur.add({ days: 1 })
    }
  }
  return map
}
