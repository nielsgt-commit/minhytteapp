import { SEASON_MIN, SEASON_MAX } from "./constants.ts"

type DotBooking = {
  id: number
  status: string
  start_date: string
  end_date: string
  occupants: { user_id: number; queued: boolean }[]
}

type DotGroup = {
  id: number
  is_family: boolean
  members: { user_id: number }[]
}

/**
 * Build the calendar's per-day occupant dots: ISO date ("YYYY-MM-DD") → one
 * family-group id per person staying that night (0 = no family group). One
 * entry per occupant, so the dot count is the headcount. Bounded to the season
 * so the map stays small. Cancelled bookings and queued occupants are ignored.
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
    const occGroups = b.occupants
      .filter(o => !o.queued)
      .map(o => familyGroupByUser.get(o.user_id) ?? 0)
    if (occGroups.length === 0) continue

    const start = b.start_date < SEASON_MIN ? SEASON_MIN : b.start_date
    const end = b.end_date > SEASON_MAX ? SEASON_MAX : b.end_date
    if (start > end) continue

    const cur = new Date(start)
    const last = new Date(end)
    while (cur <= last) {
      const iso = cur.toISOString().slice(0, 10)
      const list = map.get(iso)
      if (list) list.push(...occGroups)
      else map.set(iso, [...occGroups])
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }
  return map
}
