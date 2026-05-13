// ============================================================
// Shared types for the calendar booking flow.
// These mirror the server-side booking.previewConflicts output.
// ============================================================

export type BookingStatus = "pending" | "confirmed" | "cancelled"

export type OccupantDraft = {
  user_id: number
  room_id: number | null
  queued: boolean
}

export type BookingDraft = {
  property_id: number | null
  booker_id: number | null
  start_date: string | null
  end_date: string | null
  status: BookingStatus
  notes: string
  occupants: OccupantDraft[]
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
  start_date: string
  end_date: string
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
