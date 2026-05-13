// ============================================================
// booking-logic — shared module for the Calendar booking flow.
//
// Import surface:
//   import { ... } from "@/features/calendar/booking-logic"
//
// Types:
//   OccupantDraft, BookingDraft, BookingStatus
//   PreviewConflicts, OverlappingBooking, PerRoomConflict, PropertyConflict
//   SameUserOccupant, SharedRoomOccupant
//
// Reducer + actions:
//   bookingDraftReducer, initialBookingDraft
//   setDates, setStatus, setNotes, setBooker
//   addOccupant, removeOccupant, assignOccupantToRoom, markOccupantQueued
//   loadForEdit, resetDraft
//   BookingDraftAction, BookingDraftRecord
//
// Hook:
//   usePreviewConflicts(draft, excludeBookingId?)
//   → { data, isFetching, hasWarnings }
//
// Pure helpers:
//   bedCapacity(room)
//   propertyCapacity(rooms, buildings)
//   expandRange(start_date, end_date)
//   groupConsecutive(isos)
//   isoWeekNumber(date)
//   sundayBeforeIsoWeek(year, week)
//   toIso(date), fromIso(iso), addDays(date, n)
//   Range (type)
// ============================================================

export type {
  BookingDraft,
  BookingStatus,
  OccupantDraft,
  OverlappingBooking,
  PerRoomConflict,
  PreviewConflicts,
  PropertyConflict,
  SameUserOccupant,
  SharedRoomOccupant,
} from "./types.ts"

export {
  addOccupant,
  assignOccupantToRoom,
  bookingDraftReducer,
  initialBookingDraft,
  loadForEdit,
  markOccupantQueued,
  removeOccupant,
  resetDraft,
  setBooker,
  setDates,
  setNotes,
  setStatus,
} from "./bookingDraftReducer.ts"

export type {
  BookingDraftAction,
  BookingDraftRecord,
} from "./bookingDraftReducer.ts"

export { usePreviewConflicts } from "./usePreviewConflicts.ts"

export {
  addDays,
  bedCapacity,
  expandRange,
  fromIso,
  groupConsecutive,
  isoWeekNumber,
  propertyCapacity,
  sundayBeforeIsoWeek,
  toIso,
} from "./helpers.ts"

export type { Range } from "./helpers.ts"
