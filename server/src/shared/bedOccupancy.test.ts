import { describe, expect, test } from "vitest"
import { Temporal } from "temporal-polyfill"
import {
  BED_FILTER,
  GUEST_FILTER,
  bedAvailabilityForDay,
  guestsOnDay,
  occupantsOnDay,
  roomTotalCapacity,
  type AvailabilityRoom,
  type OccupancyBooking,
} from "./bedOccupancy.ts"

const pd = (iso: string) => Temporal.PlainDate.from(iso)

const DAY = "2030-07-02"

function booking(overrides: Partial<OccupancyBooking> = {}): OccupancyBooking {
  return {
    status: "confirmed",
    start_date: pd("2030-07-01"),
    end_date: pd("2030-07-05"),
    occupants: [],
    ...overrides,
  }
}

const occ = (
  user_id: number,
  room_id: number | null,
  extra: { queued?: boolean; sleeps_separately?: boolean } = {},
) => ({ user_id, room_id, ...extra })

const guest = (
  guest_id: number,
  room_id: number | null,
  extra: { sleeps_separately?: boolean } = {},
) => ({ guest_id, room_id, ...extra })

function room(overrides: Partial<AvailabilityRoom> = {}): AvailabilityRoom {
  return {
    id: 1,
    name: "North room",
    structure_id: 1,
    structure_name: "Main cabin",
    structure_category: "habitable",
    beds_sm: 2,
    beds_lg: 0,
    beds_double: 1,
    beds_kid: 0,
    mattresses: 0,
    travel_cot: 0,
    ...overrides,
  }
}

describe("roomTotalCapacity", () => {
  test("counts a double bed as two person-slots", () => {
    expect(roomTotalCapacity(room())).toBe(4)
  })
})

describe("occupantsOnDay", () => {
  test("includes pending and confirmed bookings, never cancelled", () => {
    const bookings = [
      booking({ status: "confirmed", occupants: [occ(1, 1)] }),
      booking({ status: "pending", occupants: [occ(2, 1)] }),
      booking({ status: "cancelled", occupants: [occ(3, 1)] }),
    ]
    const ids = occupantsOnDay(bookings, DAY, GUEST_FILTER).map(o => o.user_id)
    expect(ids.sort()).toEqual([1, 2])
  })

  test("covers start and end dates inclusively", () => {
    const b = [booking({ occupants: [occ(1, 1)] })]
    expect(occupantsOnDay(b, "2030-07-01", GUEST_FILTER)).toHaveLength(1)
    expect(occupantsOnDay(b, "2030-07-05", GUEST_FILTER)).toHaveLength(1)
    expect(occupantsOnDay(b, "2030-06-30", GUEST_FILTER)).toHaveLength(0)
    expect(occupantsOnDay(b, "2030-07-06", GUEST_FILTER)).toHaveLength(0)
  })

  test("dedupes a person across overlapping bookings, preferring the roomed entry", () => {
    const bookings = [
      booking({ occupants: [occ(1, null)] }),
      booking({ occupants: [occ(1, 2)] }),
    ]
    const result = occupantsOnDay(bookings, DAY, GUEST_FILTER)
    expect(result).toHaveLength(1)
    expect(result[0].room_id).toBe(2)
  })

  test("queued occupants count as guests but not for beds", () => {
    const bookings = [
      booking({ occupants: [occ(1, 1), occ(2, 1, { queued: true })] }),
    ]
    expect(occupantsOnDay(bookings, DAY, GUEST_FILTER)).toHaveLength(2)
    expect(occupantsOnDay(bookings, DAY, BED_FILTER)).toHaveLength(1)
  })
})

describe("guestsOnDay", () => {
  test("includes guests of pending and confirmed bookings, never cancelled", () => {
    const bookings = [
      booking({ guests: [guest(1, 1)] }),
      booking({ status: "pending", guests: [guest(2, null)] }),
      booking({ status: "cancelled", guests: [guest(3, 1)] }),
    ]
    const ids = guestsOnDay(bookings, DAY, GUEST_FILTER).map(g => g.guest_id)
    expect(ids.sort()).toEqual([1, 2])
  })

  test("respects the booking's date range", () => {
    const b = [booking({ guests: [guest(1, 1)] })]
    expect(guestsOnDay(b, "2030-07-01", GUEST_FILTER)).toHaveLength(1)
    expect(guestsOnDay(b, "2030-06-30", GUEST_FILTER)).toHaveLength(0)
  })

  test("bookings without a guests array count zero guests", () => {
    expect(guestsOnDay([booking()], DAY, GUEST_FILTER)).toHaveLength(0)
  })
})

describe("bedAvailabilityForDay", () => {
  test("counts occupants of bookings covering the day against room capacity", () => {
    const bookings = [
      booking({
        occupants: [occ(1, 1), occ(2, null)], // one placed, one without a room
      }),
    ]
    const res = bedAvailabilityForDay([room()], bookings, DAY)
    expect(res.rooms).toHaveLength(1)
    expect(res.rooms[0]).toMatchObject({
      room_id: 1,
      name: "North room",
      structure_name: "Main cabin",
      capacity: 4,
      occupied: 1,
      available: 3,
    })
    expect(res.unassignedGuests).toBe(1)
  })

  test("a pending booking holds beds like a confirmed one", () => {
    const bookings = [booking({ status: "pending", occupants: [occ(1, 1)] })]
    const res = bedAvailabilityForDay([room()], bookings, DAY)
    expect(res.rooms[0]).toMatchObject({ occupied: 1, available: 3 })
  })

  test("ignores bookings outside the day and queued occupants", () => {
    const bookings = [
      booking({
        start_date: pd("2030-08-01"),
        end_date: pd("2030-08-05"),
        occupants: [occ(1, 1)],
      }),
      booking({
        start_date: pd(DAY),
        end_date: pd(DAY),
        occupants: [occ(2, 1), occ(3, 1, { queued: true })],
      }),
    ]
    const res = bedAvailabilityForDay([room()], bookings, DAY)
    expect(res.rooms[0]).toMatchObject({ occupied: 1, available: 3 })
    expect(res.unassignedGuests).toBe(0)
  })

  test("only habitable rooms hold beds; guests in other rooms count as unassigned", () => {
    const rooms = [
      room(),
      room({ id: 2, name: "Boat house", structure_category: "outbuilding" }),
    ]
    const bookings = [booking({ occupants: [occ(1, 2)] })]
    const res = bedAvailabilityForDay(rooms, bookings, DAY)
    expect(res.rooms).toHaveLength(1)
    expect(res.rooms[0].room_id).toBe(1)
    expect(res.unassignedGuests).toBe(1)
  })

  test("sleeps-separately occupants hold no bed and are not unassigned", () => {
    const bookings = [
      booking({
        occupants: [occ(1, 1), occ(2, null, { sleeps_separately: true })],
      }),
    ]
    const res = bedAvailabilityForDay([room()], bookings, DAY)
    expect(res.rooms[0]).toMatchObject({ occupied: 1 })
    expect(res.unassignedGuests).toBe(0)
  })

  test("guests hold beds like occupants; unroomed and tent guests follow the same rules", () => {
    const bookings = [
      booking({
        occupants: [occ(1, 1)],
        guests: [
          guest(1, 1),
          guest(2, null),
          guest(3, null, { sleeps_separately: true }),
        ],
      }),
    ]
    const res = bedAvailabilityForDay([room()], bookings, DAY)
    expect(res.rooms[0]).toMatchObject({ occupied: 2, available: 2 })
    expect(res.unassignedGuests).toBe(1)
  })

  test("available never goes below zero", () => {
    const bookings = [
      booking({
        occupants: [1, 2, 3, 4, 5].map(id => occ(id, 1)),
      }),
    ]
    const res = bedAvailabilityForDay([room()], bookings, DAY)
    expect(res.rooms[0]).toMatchObject({ occupied: 5, available: 0 })
  })
})
