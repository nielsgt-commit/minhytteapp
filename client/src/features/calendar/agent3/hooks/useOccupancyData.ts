import { useMemo } from "react"
import { bedCapacity, propertyCapacity } from "@/features/calendar/booking-logic"
import type { BookingDraft, PreviewConflicts } from "@/features/calendar/booking-logic"
import type { RoomShape, ExistingOccupant } from "../types"

type Booking = {
  id: number
  status: string
  start_date: string
  end_date: string
  booker_id: number
  booker_name: string | null
  occupants: { user_id: number; room_id: number | null; queued: boolean; user_name: string | null }[]
}

type Structure = { id: number; category: string }

export function useOccupancyData({
  bookings,
  draft,
  propertyRooms,
  propertyStructures,
  conflicts,
}: {
  bookings: Booking[]
  draft: BookingDraft
  propertyRooms: RoomShape[]
  propertyStructures: Structure[]
  conflicts: PreviewConflicts | undefined
}) {
  const totalBeds = useMemo(
    () => propertyCapacity(propertyRooms, propertyStructures),
    [propertyRooms, propertyStructures],
  )

  const occupiedBeds = useMemo(() => {
    if (!draft.start_date || !draft.end_date) return null
    let peak = 0
    const cur = new Date(draft.start_date)
    const end = new Date(draft.end_date)
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10)
      let dayCount = 0
      for (const b of bookings) {
        if (b.status === "cancelled") continue
        if (b.start_date > d || b.end_date < d) continue
        dayCount += b.occupants.filter(o => !o.queued).length
      }
      if (dayCount > peak) peak = dayCount
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return peak
  }, [bookings, draft.start_date, draft.end_date])

  const occupantsByRoom = useMemo(() => {
    const byRoom = new Map<number | null, { user_id: number; queued: boolean }[]>()
    for (const o of draft.occupants) {
      const key = o.room_id ?? null
      const list = byRoom.get(key) ?? []
      list.push(o)
      byRoom.set(key, list)
    }
    return byRoom
  }, [draft.occupants])

  const unassigned = occupantsByRoom.get(null) ?? []

  const adultInKidOnlyByRoom = useMemo(() => {
    const map = new Map<number, number[]>()
    for (const r of conflicts?.perRoom ?? []) {
      map.set(r.room_id, r.adultInKidOnlyUserIds)
    }
    return map
  }, [conflicts])

  const overlappingBookings = useMemo(() => {
    if (!draft.start_date || !draft.end_date) return []
    const s = draft.start_date
    const e = draft.end_date
    return bookings.filter(b => b.status !== "cancelled" && b.start_date <= e && b.end_date >= s)
  }, [bookings, draft.start_date, draft.end_date])

  const existingOccupantsByRoom = useMemo(() => {
    const map = new Map<number, ExistingOccupant[]>()
    for (const b of overlappingBookings) {
      for (const o of b.occupants) {
        if (o.room_id == null) continue
        const list = map.get(o.room_id) ?? []
        list.push({ user_id: o.user_id, user_name: o.user_name, queued: o.queued })
        map.set(o.room_id, list)
      }
    }
    return map
  }, [overlappingBookings])

  const roomOverCapacityDays = useMemo(() => {
    const map = new Map<number, string[]>()
    if (!draft.start_date || !draft.end_date) return map

    const draftByRoom = new Map<number, Set<number>>()
    for (const o of draft.occupants) {
      if (o.room_id == null) continue
      if (o.queued) continue
      let set = draftByRoom.get(o.room_id)
      if (!set) {
        set = new Set()
        draftByRoom.set(o.room_id, set)
      }
      set.add(o.user_id)
    }

    const cur = new Date(draft.start_date)
    const end = new Date(draft.end_date)
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10)
      for (const room of propertyRooms) {
        const placed = new Set<number>(draftByRoom.get(room.id) ?? [])
        for (const b of bookings) {
          if (b.status === "cancelled") continue
          if (b.start_date > d || b.end_date < d) continue
          for (const o of b.occupants) {
            if (o.room_id !== room.id) continue
            if (o.queued) continue
            placed.add(o.user_id)
          }
        }
        if (placed.size > bedCapacity(room)) {
          const list = map.get(room.id) ?? []
          list.push(d)
          map.set(room.id, list)
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return map
  }, [bookings, draft.occupants, draft.start_date, draft.end_date, propertyRooms])

  return {
    totalBeds,
    occupiedBeds,
    occupantsByRoom,
    unassigned,
    adultInKidOnlyByRoom,
    overlappingBookings,
    existingOccupantsByRoom,
    roomOverCapacityDays,
  }
}
