// ============================================================
// Shared types for the calendar booking flow.
// These mirror the server-side booking.previewConflicts output.
// ============================================================

import type { Temporal } from "temporal-polyfill"

export type BookingStatus = "pending" | "confirmed" | "cancelled"

export type OccupantDraft = {
  user_id: number
  room_id: number | null
  queued: boolean
  sleeps_separately: boolean
}

// A named non-user guest. Guests ride along in `occupants` under synthetic
// negative user_ids so room/tent assignment works unchanged; this registry
// maps those ids back to a name and child flag for display and submission.
export type GuestDraft = {
  user_id: number
  name: string
  is_child: boolean
}

export type BookingDraft = {
  property_id: number | null
  booker_id: number | null
  start_date: string | null
  end_date: string | null
  status: BookingStatus
  notes: string
  occupants: OccupantDraft[]
  guests: GuestDraft[]
}

// ---- previewConflicts output types ----

export type SameUserOccupant = {
  user_id: number
  user_name: string
}

export type SharedRoomOccupant = {
  room_id: number
  room_name: string
  otherUserCount: number
}

export type OverlappingBooking = {
  booking_id: number
  booker_id: number
  booker_name: string
  start_date: Temporal.PlainDate
  end_date: Temporal.PlainDate
  status: BookingStatus
  sharedDays: number
  sameUserOccupants: SameUserOccupant[]
  sharedRoomOccupants: SharedRoomOccupant[]
}

export type PerRoomConflict = {
  room_id: number
  room_name: string
  capacity: number
  placedCount: number
  overCapacityBy: number
  adultInKidOnlyUserIds: number[]
}

export type PropertyConflict = {
  totalCapacity: number
  totalPlaced: number
  overCapacityBy: number
}

export type PreviewConflicts = {
  overlappingBookings: OverlappingBooking[]
  perRoom: PerRoomConflict[]
  property: PropertyConflict
}
