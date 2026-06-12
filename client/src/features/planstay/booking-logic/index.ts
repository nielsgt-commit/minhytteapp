// ============================================================
// booking-logic — shared module for the Calendar booking flow.
//
// Import surface:
//   import { ... } from "@/features/planstay/booking-logic"
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
//   setOccupantSeparate
//   loadForEdit, resetDraft
//   BookingDraftAction, BookingDraftRecord
//
// Hook:
//   usePreviewConflicts(draft, excludeBookingId?)
//   → { data, isFetching, hasWarnings }
//
// Pure helpers:
//   bedCapacity(room)
//   propertyCapacity(rooms, structures)
//   expandRange(start_date, end_date)
//   groupConsecutive(isos)
//   isoWeekNumber(plainDate)
//   sundayBeforeIsoWeek(year, week)
//   fromIso(iso), addDays(plainDate, n)
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
  setOccupantSeparate,
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
} from "./helpers.ts"

export type { Range } from "./helpers.ts"
