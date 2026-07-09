import type { Temporal } from "temporal-polyfill"
import {
  GUEST_FILTER,
  occupantsOnDay,
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
}

export type BookingInfo = {
  status: string
  start_date: Temporal.PlainDate
  end_date: Temporal.PlainDate
  occupants: OccupantInfo[]
}

export type RoomGroup = {
  roomId: number | null
  roomName: string
  buildingName: string | null
  guests: string[]
}

// Everyone sleeping at the property on `iso`, grouped by their room and sorted
// by building then room. Guests sharing a room across bookings are merged.
export function roomGroupsForDay(
  bookings: readonly BookingInfo[],
  roomById: Map<number, RoomInfo>,
  iso: string,
  unassignedLabel: string,
): RoomGroup[] {
  const byRoom = new Map<number | null, Map<number, string>>()
  for (const o of occupantsOnDay(bookings, iso, GUEST_FILTER)) {
    const guests = byRoom.get(o.room_id) ?? new Map<number, string>()
    guests.set(o.user_id, o.user_name ?? `#${String(o.user_id)}`)
    byRoom.set(o.room_id, guests)
  }

  const groups: RoomGroup[] = []
  for (const [roomId, guests] of byRoom) {
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
