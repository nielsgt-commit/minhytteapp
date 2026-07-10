import type { Temporal } from "temporal-polyfill"
import {
  GUEST_FILTER,
  occupantsOnDay,
  TENT_ROOM_ID,
} from "@server/shared/bedOccupancy.ts"

export type RoomInfo = {
  id: number
  name: string
  structure_name: string
}

export type OccupantInfo = {
  room_id: number | null
  user_id: number
  user_name: string | null
  queued?: boolean
  sleeps_separately?: boolean
}

export type BookingInfo = {
  status: string
  start_date: Temporal.PlainDate
  end_date: Temporal.PlainDate
  occupants: OccupantInfo[]
}

export type GuestChip = {
  name: string
  queued: boolean
  // From a pending (unconfirmed) booking — rendered with a "?" after the name.
  pending: boolean
}

export type RoomGroup = {
  roomId: number | null
  roomName: string
  buildingName: string | null
  guests: GuestChip[]
}

// Everyone sleeping at the property on `iso`, grouped by their room and sorted
// by building then room. Guests sharing a room across bookings are merged.
// Sleeps-separately guests get a virtual "Tent" building+room, present only on
// days someone actually sleeps in a tent.
export function roomGroupsForDay(
  bookings: readonly BookingInfo[],
  roomById: Map<number, RoomInfo>,
  iso: string,
  unassignedLabel: string,
  tentLabel: string,
): RoomGroup[] {
  // Occupants don't carry their booking's status, so stamp it on before the
  // day filter; the dedupe in occupantsOnDay then picks the flag along with
  // the entry it keeps.
  const stamped = bookings.map(b => ({
    ...b,
    occupants: b.occupants.map(o => ({
      ...o,
      pending: b.status === "pending",
    })),
  }))

  const byRoom = new Map<number | null, Map<number, GuestChip>>()
  for (const o of occupantsOnDay(stamped, iso, GUEST_FILTER)) {
    const key = o.sleeps_separately === true ? TENT_ROOM_ID : o.room_id
    const guests = byRoom.get(key) ?? new Map<number, GuestChip>()
    guests.set(o.user_id, {
      name: o.user_name ?? `#${String(o.user_id)}`,
      queued: o.queued === true,
      pending: o.pending,
    })
    byRoom.set(key, guests)
  }

  const groups: RoomGroup[] = []
  for (const [roomId, guests] of byRoom) {
    if (roomId === TENT_ROOM_ID) {
      groups.push({
        roomId,
        roomName: tentLabel,
        buildingName: tentLabel,
        guests: Array.from(guests.values()),
      })
      continue
    }
    const room = roomId == null ? undefined : roomById.get(roomId)
    groups.push({
      roomId,
      roomName: room ? room.name : unassignedLabel,
      buildingName: room ? room.structure_name : null,
      guests: Array.from(guests.values()),
    })
  }

  groups.sort((a, b) => {
    const building = (a.buildingName ?? "").localeCompare(b.buildingName ?? "")
    if (building !== 0) return building
    return a.roomName.localeCompare(b.roomName)
  })
  return groups
}
