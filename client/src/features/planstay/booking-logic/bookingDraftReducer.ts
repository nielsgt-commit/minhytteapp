import type {
  BookingDraft,
  BookingStatus,
  GuestDraft,
  OccupantDraft,
} from "./types.ts"

// ============================================================
// Booking draft reducer — occupants-first model.
// "Individual" is just a draft with one occupant equal to the booker.
// No `mode` field needed.
// ============================================================

export const initialBookingDraft: BookingDraft = {
  property_id: null,
  booker_id: null,
  start_date: null,
  end_date: null,
  status: "confirmed",
  notes: "",
  occupants: [],
  guests: [],
}

// Synthetic ids live below every id already in the draft, so removing and
// re-adding guests can never recycle an id still assigned to a room.
function nextGuestId(state: BookingDraft): number {
  return Math.min(0, ...state.occupants.map(o => o.user_id)) - 1
}

// ---- Action types ----

export type BookingDraftAction =
  | { type: "SET_DATES"; start_date: string; end_date: string }
  | { type: "SET_STATUS"; status: BookingStatus }
  | { type: "SET_NOTES"; notes: string }
  | { type: "SET_BOOKER"; booker_id: number; property_id: number }
  | { type: "ADD_OCCUPANT"; user_id: number; room_id?: number | null }
  | { type: "REMOVE_OCCUPANT"; user_id: number }
  | { type: "ADD_GUEST"; name: string; is_child: boolean }
  | { type: "SET_GUEST_CHILD"; user_id: number; is_child: boolean }
  | {
      type: "ASSIGN_OCCUPANT_TO_ROOM"
      user_id: number
      room_id: number | null
    }
  | { type: "MARK_OCCUPANT_QUEUED"; user_id: number; queued: boolean }
  | { type: "SET_OCCUPANT_SEPARATE"; user_id: number; separate: boolean }
  | { type: "LOAD_FOR_EDIT"; record: BookingDraftRecord }
  | { type: "RESET" }

/**
 * Shape of a persisted booking record (from the server) that can be
 * loaded into the draft for editing.
 */
export type BookingDraftRecord = {
  id?: number
  property_id: number
  booker_id: number
  start_date: string
  end_date: string
  status: BookingStatus
  notes: string | null
  occupants: {
    user_id: number
    room_id: number | null
    queued: boolean
    sleeps_separately?: boolean
  }[]
  guests?: {
    name: string
    is_child: boolean
    room_id: number | null
    sleeps_separately?: boolean
  }[]
}

// ---- Action creators ----

export const setDates = (
  start_date: string,
  end_date: string,
): BookingDraftAction => ({ type: "SET_DATES", start_date, end_date })

export const setStatus = (status: BookingStatus): BookingDraftAction => ({
  type: "SET_STATUS",
  status,
})

export const setNotes = (notes: string): BookingDraftAction => ({
  type: "SET_NOTES",
  notes,
})

export const setBooker = (
  booker_id: number,
  property_id: number,
): BookingDraftAction => ({ type: "SET_BOOKER", booker_id, property_id })

export const addOccupant = (
  user_id: number,
  room_id?: number | null,
): BookingDraftAction => ({ type: "ADD_OCCUPANT", user_id, room_id })

export const removeOccupant = (user_id: number): BookingDraftAction => ({
  type: "REMOVE_OCCUPANT",
  user_id,
})

export const addGuest = (
  name: string,
  is_child = false,
): BookingDraftAction => ({ type: "ADD_GUEST", name, is_child })

export const setGuestChild = (
  user_id: number,
  is_child: boolean,
): BookingDraftAction => ({ type: "SET_GUEST_CHILD", user_id, is_child })

export const assignOccupantToRoom = (
  user_id: number,
  room_id: number | null,
): BookingDraftAction => ({ type: "ASSIGN_OCCUPANT_TO_ROOM", user_id, room_id })

export const markOccupantQueued = (
  user_id: number,
  queued: boolean,
): BookingDraftAction => ({ type: "MARK_OCCUPANT_QUEUED", user_id, queued })

export const setOccupantSeparate = (
  user_id: number,
  separate: boolean,
): BookingDraftAction => ({ type: "SET_OCCUPANT_SEPARATE", user_id, separate })

export const loadForEdit = (
  record: BookingDraftRecord,
): BookingDraftAction => ({ type: "LOAD_FOR_EDIT", record })

export const resetDraft = (): BookingDraftAction => ({ type: "RESET" })

// ---- Reducer ----

export function bookingDraftReducer(
  state: BookingDraft,
  action: BookingDraftAction,
): BookingDraft {
  switch (action.type) {
    case "SET_DATES":
      return {
        ...state,
        start_date: action.start_date,
        end_date: action.end_date,
      }

    case "SET_STATUS":
      return { ...state, status: action.status }

    case "SET_NOTES":
      return { ...state, notes: action.notes }

    case "SET_BOOKER": {
      // Ensure booker is in occupants list
      const alreadyIn = state.occupants.some(
        o => o.user_id === action.booker_id,
      )
      const occupants = alreadyIn
        ? state.occupants
        : [
            {
              user_id: action.booker_id,
              room_id: null,
              queued: false,
              sleeps_separately: false,
            },
            ...state.occupants,
          ]
      return {
        ...state,
        booker_id: action.booker_id,
        property_id: action.property_id,
        occupants,
      }
    }

    case "ADD_OCCUPANT": {
      const alreadyIn = state.occupants.some(o => o.user_id === action.user_id)
      if (alreadyIn) return state
      const newOccupant: OccupantDraft = {
        user_id: action.user_id,
        room_id: action.room_id ?? null,
        queued: false,
        sleeps_separately: false,
      }
      return { ...state, occupants: [...state.occupants, newOccupant] }
    }

    case "REMOVE_OCCUPANT":
      return {
        ...state,
        occupants: state.occupants.filter(o => o.user_id !== action.user_id),
        guests: state.guests.filter(g => g.user_id !== action.user_id),
      }

    case "ADD_GUEST": {
      const id = nextGuestId(state)
      const occupant: OccupantDraft = {
        user_id: id,
        room_id: null,
        queued: false,
        sleeps_separately: false,
      }
      const guest: GuestDraft = {
        user_id: id,
        name: action.name,
        is_child: action.is_child,
      }
      return {
        ...state,
        occupants: [...state.occupants, occupant],
        guests: [...state.guests, guest],
      }
    }

    case "SET_GUEST_CHILD":
      return {
        ...state,
        guests: state.guests.map(g =>
          g.user_id === action.user_id
            ? { ...g, is_child: action.is_child }
            : g,
        ),
      }

    case "ASSIGN_OCCUPANT_TO_ROOM":
      return {
        ...state,
        occupants: state.occupants.map(o =>
          o.user_id === action.user_id
            ? { ...o, room_id: action.room_id, sleeps_separately: false }
            : o,
        ),
      }

    case "MARK_OCCUPANT_QUEUED":
      return {
        ...state,
        occupants: state.occupants.map(o =>
          o.user_id === action.user_id ? { ...o, queued: action.queued } : o,
        ),
      }

    case "SET_OCCUPANT_SEPARATE":
      return {
        ...state,
        occupants: state.occupants.map(o =>
          o.user_id === action.user_id
            ? action.separate
              ? {
                  ...o,
                  sleeps_separately: true,
                  room_id: null,
                  queued: false,
                }
              : { ...o, sleeps_separately: false }
            : o,
        ),
      }

    case "LOAD_FOR_EDIT": {
      const recordGuests = action.record.guests ?? []
      return {
        property_id: action.record.property_id,
        booker_id: action.record.booker_id,
        start_date: action.record.start_date,
        end_date: action.record.end_date,
        status: action.record.status,
        notes: action.record.notes ?? "",
        occupants: [
          ...action.record.occupants.map(o => ({
            user_id: o.user_id,
            room_id: o.room_id,
            queued: o.queued,
            sleeps_separately: o.sleeps_separately ?? false,
          })),
          ...recordGuests.map((g, i) => ({
            user_id: -(i + 1),
            room_id: g.room_id,
            queued: false,
            sleeps_separately: g.sleeps_separately ?? false,
          })),
        ],
        guests: recordGuests.map((g, i) => ({
          user_id: -(i + 1),
          name: g.name,
          is_child: g.is_child,
        })),
      }
    }

    case "RESET":
      return initialBookingDraft

    default:
      return state
  }
}
