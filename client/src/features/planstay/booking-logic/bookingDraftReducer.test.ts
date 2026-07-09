import { describe, expect, test } from "vitest"
import {
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
import type { BookingDraftRecord } from "./bookingDraftReducer.ts"

describe("setDates", () => {
  test("updates both dates", () => {
    const next = bookingDraftReducer(
      initialBookingDraft,
      setDates("2026-07-01", "2026-07-05"),
    )
    expect(next.start_date).toBe("2026-07-01")
    expect(next.end_date).toBe("2026-07-05")
  })
})

describe("setStatus / setNotes", () => {
  test("setStatus replaces status", () => {
    const next = bookingDraftReducer(initialBookingDraft, setStatus("pending"))
    expect(next.status).toBe("pending")
  })

  test("setNotes replaces notes", () => {
    const next = bookingDraftReducer(initialBookingDraft, setNotes("Hello"))
    expect(next.notes).toBe("Hello")
  })
})

describe("setBooker", () => {
  test("sets booker_id, property_id and prepends booker as occupant", () => {
    const next = bookingDraftReducer(initialBookingDraft, setBooker(7, 42))
    expect(next.booker_id).toBe(7)
    expect(next.property_id).toBe(42)
    expect(next.occupants).toEqual([
      { user_id: 7, room_id: null, queued: false, sleeps_separately: false },
    ])
  })

  test("does not duplicate booker if already present", () => {
    const seeded = bookingDraftReducer(initialBookingDraft, addOccupant(7, 3))
    const next = bookingDraftReducer(seeded, setBooker(7, 42))
    expect(next.occupants).toHaveLength(1)
    expect(next.occupants[0]?.room_id).toBe(3)
  })
})

describe("addOccupant / removeOccupant", () => {
  test("addOccupant appends with default null room", () => {
    const next = bookingDraftReducer(initialBookingDraft, addOccupant(9))
    expect(next.occupants).toEqual([
      { user_id: 9, room_id: null, queued: false, sleeps_separately: false },
    ])
  })

  test("addOccupant is idempotent for existing user_id", () => {
    const once = bookingDraftReducer(initialBookingDraft, addOccupant(9, 1))
    const twice = bookingDraftReducer(once, addOccupant(9, 2))
    expect(twice).toBe(once)
  })

  test("removeOccupant drops matching user", () => {
    const seeded = bookingDraftReducer(
      bookingDraftReducer(initialBookingDraft, addOccupant(1)),
      addOccupant(2),
    )
    const next = bookingDraftReducer(seeded, removeOccupant(1))
    expect(next.occupants.map(o => o.user_id)).toEqual([2])
  })

  test("booker can be removed and re-added without a room ('not staying' toggle)", () => {
    const seeded = bookingDraftReducer(initialBookingDraft, setBooker(7, 42))
    const removed = bookingDraftReducer(seeded, removeOccupant(7))
    expect(removed.occupants).toEqual([])
    expect(removed.booker_id).toBe(7)
    const restored = bookingDraftReducer(removed, addOccupant(7, null))
    expect(restored.occupants).toEqual([
      { user_id: 7, room_id: null, queued: false, sleeps_separately: false },
    ])
  })
})

describe("assignOccupantToRoom / markOccupantQueued", () => {
  test("assignOccupantToRoom updates only the targeted occupant", () => {
    const seeded = bookingDraftReducer(
      bookingDraftReducer(initialBookingDraft, addOccupant(1)),
      addOccupant(2),
    )
    const next = bookingDraftReducer(seeded, assignOccupantToRoom(2, 5))
    expect(next.occupants.find(o => o.user_id === 2)?.room_id).toBe(5)
    expect(next.occupants.find(o => o.user_id === 1)?.room_id).toBeNull()
  })

  test("markOccupantQueued flips queued flag for the targeted user", () => {
    const seeded = bookingDraftReducer(initialBookingDraft, addOccupant(3))
    const next = bookingDraftReducer(seeded, markOccupantQueued(3, true))
    expect(next.occupants[0]?.queued).toBe(true)
  })
})

describe("loadForEdit / resetDraft", () => {
  test("loadForEdit hydrates draft from record and normalizes null notes", () => {
    const record: BookingDraftRecord = {
      property_id: 11,
      booker_id: 22,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
      status: "pending",
      notes: null,
      occupants: [{ user_id: 22, room_id: 4, queued: false }],
    }
    const next = bookingDraftReducer(initialBookingDraft, loadForEdit(record))
    expect(next.property_id).toBe(11)
    expect(next.booker_id).toBe(22)
    expect(next.notes).toBe("")
    expect(next.occupants).toEqual([
      { user_id: 22, room_id: 4, queued: false, sleeps_separately: false },
    ])
  })

  test("RESET returns the initial draft", () => {
    const dirty = bookingDraftReducer(initialBookingDraft, setNotes("x"))
    expect(bookingDraftReducer(dirty, resetDraft())).toEqual(
      initialBookingDraft,
    )
  })
})
