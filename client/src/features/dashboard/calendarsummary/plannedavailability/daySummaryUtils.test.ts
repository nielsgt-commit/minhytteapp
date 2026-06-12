import { describe, expect, test } from "vitest"
import { Temporal } from "temporal-polyfill"
import {
  roomGroupsForDay,
  type BookingInfo,
  type RoomInfo,
} from "./daySummaryUtils"

const pd = (iso: string) => Temporal.PlainDate.from(iso)

const rooms = new Map<number, RoomInfo>([
  [1, { id: 1, name: "Loft", structure_name: "Main cabin" }],
  [2, { id: 2, name: "Bunk room", structure_name: "Annex" }],
])

const occ = (user_id: number, room_id: number | null, name: string | null) => ({
  user_id,
  room_id,
  user_name: name,
})

describe("roomGroupsForDay", () => {
  test("groups guests by room and sorts by building then room", () => {
    const bookings: BookingInfo[] = [
      {
        status: "confirmed",
        start_date: pd("2026-07-10"),
        end_date: pd("2026-07-15"),
        occupants: [occ(1, 1, "Alice"), occ(2, 2, "Bob")],
      },
    ]
    const groups = roomGroupsForDay(bookings, rooms, "2026-07-12", "Unassigned")
    // Annex (Bunk room) sorts before Main cabin (Loft).
    expect(groups.map(g => g.buildingName)).toEqual(["Annex", "Main cabin"])
    expect(groups[0]).toMatchObject({ roomName: "Bunk room", guests: ["Bob"] })
    expect(groups[1]).toMatchObject({ roomName: "Loft", guests: ["Alice"] })
  })

  test("excludes cancelled bookings", () => {
    const bookings: BookingInfo[] = [
      {
        status: "cancelled",
        start_date: pd("2026-07-10"),
        end_date: pd("2026-07-15"),
        occupants: [occ(1, 1, "Alice")],
      },
    ]
    expect(
      roomGroupsForDay(bookings, rooms, "2026-07-12", "Unassigned"),
    ).toEqual([])
  })

  test("end_date is inclusive, start_date is inclusive", () => {
    const bookings: BookingInfo[] = [
      {
        status: "confirmed",
        start_date: pd("2026-07-10"),
        end_date: pd("2026-07-12"),
        occupants: [occ(1, 1, "Alice")],
      },
    ]
    expect(
      roomGroupsForDay(bookings, rooms, "2026-07-10", "Unassigned"),
    ).toHaveLength(1)
    expect(
      roomGroupsForDay(bookings, rooms, "2026-07-12", "Unassigned"),
    ).toHaveLength(1)
    // Day after end_date -> nobody.
    expect(
      roomGroupsForDay(bookings, rooms, "2026-07-13", "Unassigned"),
    ).toEqual([])
  })

  test("merges the same guest across overlapping bookings without duplicates", () => {
    const bookings: BookingInfo[] = [
      {
        status: "confirmed",
        start_date: pd("2026-07-10"),
        end_date: pd("2026-07-12"),
        occupants: [occ(1, 1, "Alice")],
      },
      {
        status: "confirmed",
        start_date: pd("2026-07-12"),
        end_date: pd("2026-07-14"),
        occupants: [occ(1, 1, "Alice")],
      },
    ]
    const groups = roomGroupsForDay(bookings, rooms, "2026-07-12", "Unassigned")
    expect(groups).toHaveLength(1)
    expect(groups[0].guests).toEqual(["Alice"])
  })

  test("uses the fallback label and no building for unassigned occupants", () => {
    const bookings: BookingInfo[] = [
      {
        status: "confirmed",
        start_date: pd("2026-07-10"),
        end_date: pd("2026-07-15"),
        occupants: [occ(1, null, "Alice")],
      },
    ]
    const groups = roomGroupsForDay(bookings, rooms, "2026-07-12", "Unassigned")
    expect(groups[0]).toMatchObject({
      roomId: null,
      roomName: "Unassigned",
      buildingName: null,
      guests: ["Alice"],
    })
  })

  test("falls back to #id when the occupant has no name", () => {
    const bookings: BookingInfo[] = [
      {
        status: "confirmed",
        start_date: pd("2026-07-10"),
        end_date: pd("2026-07-15"),
        occupants: [occ(7, 1, null)],
      },
    ]
    const groups = roomGroupsForDay(bookings, rooms, "2026-07-12", "Unassigned")
    expect(groups[0].guests).toEqual(["#7"])
  })
})
