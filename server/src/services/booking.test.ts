// Unit tests for the booking allocation service. The full booking mutations
// (create/update/transferBooker over HTTP-shaped input) are covered in
// trpc/routers/booking.test.ts; this file exercises the extracted domain
// logic directly — the pure allocation math without a database, and the two
// DB-backed guards against a real rolled-back transaction.

import { afterAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { pool } from "../db/client.ts"
import {
  propertyTable,
  roomTable,
  structuresTable,
} from "../db/schema/property.schema.ts"
import { settlementsTable } from "../db/schema/settlement.schema.ts"
import { usersTable } from "../db/schema/users.schema.ts"
import type { Tx } from "../trpc/test-utils.ts"
import { dbFor, withRollback } from "../trpc/test-utils.ts"
import type { OccupantInput, RoomCapacity } from "./booking.ts"
import {
  allocateRoom,
  assertBookingsUnlocked,
  computeBookingRooms,
  computeOccupantQueued,
  dedupeOccupants,
  occupantRowValues,
  resolveRoomsAndUsers,
} from "./booking.ts"

afterAll(async () => {
  await pool.end()
})

function room(partial: Partial<RoomCapacity>): RoomCapacity {
  return {
    id: 1,
    name: "Room",
    property_id: 1,
    structure_category: "habitable",
    beds_sm: 0,
    beds_lg: 0,
    beds_double: 0,
    beds_kid: 0,
    mattresses: 0,
    travel_cot: 0,
    ...partial,
  }
}

function occupant(
  partial: Partial<OccupantInput> & { user_id: number },
): OccupantInput {
  return { queued: false, sleeps_separately: false, ...partial }
}

describe("allocateRoom", () => {
  it("places kids cot-first, then kid beds, then shared beds", () => {
    const r = room({ travel_cot: 1, beds_kid: 1, beds_sm: 1 })
    const result = allocateRoom(r, [], [1, 2, 3])
    expect(result.used).toMatchObject({
      travel_cot: 1,
      beds_kid: 1,
      beds_sm: 1,
    })
    expect(result.overflowUserIds).toEqual([])
  })

  it("refuses adults when only kid-only beds remain", () => {
    const r = room({ travel_cot: 1, beds_kid: 1 })
    const result = allocateRoom(r, [10], [])
    expect(result.overflowUserIds).toEqual([10])
    expect(result.adultInKidOnlyUserIds).toEqual([10])
    expect(result.used.travel_cot).toBe(0)
    expect(result.used.beds_kid).toBe(0)
  })

  it("counts double beds in person-slots", () => {
    // One double bed sleeps two adults; a single occupant still uses the bed.
    const two = allocateRoom(room({ beds_double: 1 }), [10, 11], [])
    expect(two.used.beds_double).toBe(1)
    expect(two.overflowUserIds).toEqual([])
    const one = allocateRoom(room({ beds_double: 1 }), [10], [])
    expect(one.used.beds_double).toBe(1)
    expect(one.overflowUserIds).toEqual([])
  })

  it("returns excess occupants as overflow instead of throwing", () => {
    const result = allocateRoom(room({ beds_sm: 1 }), [10, 11], [])
    expect(result.used.beds_sm).toBe(1)
    expect(result.overflowUserIds).toEqual([11])
    expect(result.adultInKidOnlyUserIds).toEqual([])
  })
})

describe("dedupeOccupants", () => {
  it("keeps the first occurrence of a user", () => {
    const deduped = dedupeOccupants([
      occupant({ user_id: 1, room_id: 5 }),
      occupant({ user_id: 2 }),
      occupant({ user_id: 1, room_id: 7 }),
    ])
    expect(deduped).toHaveLength(2)
    expect(deduped[0]).toMatchObject({ user_id: 1, room_id: 5 })
  })
})

describe("computeBookingRooms", () => {
  it("skips unassigned occupants and reports per-room overflow", () => {
    const r = room({ id: 5, beds_sm: 1 })
    const users = new Map([
      [1, { id: 1, name: "A", is_child: false }],
      [2, { id: 2, name: "B", is_child: false }],
      [3, { id: 3, name: "C", is_child: false }],
    ])
    const result = computeBookingRooms(
      [
        occupant({ user_id: 1, room_id: 5 }),
        occupant({ user_id: 2, room_id: 5 }),
        occupant({ user_id: 3, room_id: null }),
      ],
      new Map([[5, r]]),
      users,
    )
    expect(result.bookingRooms).toHaveLength(1)
    expect(result.bookingRooms[0]).toMatchObject({ room_id: 5, beds_sm: 1 })
    expect(result.overflowByRoom.get(5)).toEqual([2])
  })
})

describe("computeOccupantQueued / occupantRowValues", () => {
  it("honours explicit queued and infers queued from overflow", () => {
    const occupants = [
      occupant({ user_id: 1, room_id: 5 }),
      occupant({ user_id: 2, room_id: 5 }),
      occupant({ user_id: 3, queued: true }),
    ]
    const queued = computeOccupantQueued(occupants, new Map([[5, [2]]]))
    expect(queued.get(1)).toBe(false)
    expect(queued.get(2)).toBe(true)
    expect(queued.get(3)).toBe(true)
  })

  it("clears room and queued for occupants sleeping separately", () => {
    const occupants = [
      occupant({
        user_id: 1,
        room_id: 5,
        queued: true,
        sleeps_separately: true,
      }),
      occupant({ user_id: 2, room_id: 5 }),
    ]
    const queued = computeOccupantQueued(occupants, new Map())
    const rows = occupantRowValues(42, occupants, queued)
    expect(rows[0]).toEqual({
      booking_id: 42,
      user_id: 1,
      room_id: null,
      queued: false,
      sleeps_separately: true,
    })
    expect(rows[1]).toEqual({
      booking_id: 42,
      user_id: 2,
      room_id: 5,
      queued: false,
      sleeps_separately: false,
    })
  })
})

describe("resolveRoomsAndUsers", () => {
  it("rejects rooms from another property and unknown users", async () => {
    await withRollback(async tx => {
      const seeded = await seedTwoProperties(tx)
      // Room belongs to property B, booking is for property A.
      await expect(
        resolveRoomsAndUsers(dbFor(tx), seeded.propA.id, [
          occupant({ user_id: seeded.user.id, room_id: seeded.roomB.id }),
        ]),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      // Unknown user id.
      await expect(
        resolveRoomsAndUsers(dbFor(tx), seeded.propA.id, [
          occupant({ user_id: 999_999_999, room_id: seeded.roomA.id }),
        ]),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      // Happy path.
      const { roomById, userById } = await resolveRoomsAndUsers(
        dbFor(tx),
        seeded.propA.id,
        [occupant({ user_id: seeded.user.id, room_id: seeded.roomA.id })],
      )
      expect(roomById.has(seeded.roomA.id)).toBe(true)
      expect(userById.has(seeded.user.id)).toBe(true)
    })
  })
})

describe("assertBookingsUnlocked", () => {
  it("locks only when the open settlement is past collecting and the range overlaps its year", async () => {
    await withRollback(async tx => {
      const { propA, user } = await seedTwoProperties(tx)
      const [settlement] = await tx
        .insert(settlementsTable)
        .values({
          property_id: propA.id,
          year: 2026,
          status: "open",
          split_policy: "occupancy_days",
          created_by_id: user.id,
        })
        .returning()
      const inYear = [{ start_date: "2026-06-01", end_date: "2026-06-03" }]
      const outsideYear = [{ start_date: "2027-02-01", end_date: "2027-02-03" }]

      // Collecting phases: unlocked.
      await expect(
        assertBookingsUnlocked(dbFor(tx), propA.id, inYear),
      ).resolves.toBeUndefined()

      await tx
        .update(settlementsTable)
        .set({ phase: "reviewing" })
        .where(eq(settlementsTable.id, settlement.id))

      // Reviewing + overlapping range: locked.
      await expect(
        assertBookingsUnlocked(dbFor(tx), propA.id, inYear),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      // Reviewing + non-overlapping range: unlocked.
      await expect(
        assertBookingsUnlocked(dbFor(tx), propA.id, outsideYear),
      ).resolves.toBeUndefined()
    })
  })
})

async function seedTwoProperties(tx: Tx) {
  const [propA] = await tx
    .insert(propertyTable)
    .values({ name: "Booking Service A", address: "addr" })
    .returning()
  const [propB] = await tx
    .insert(propertyTable)
    .values({ name: "Booking Service B", address: "addr2" })
    .returning()
  const [structA] = await tx
    .insert(structuresTable)
    .values({ name: "Cabin A", property_id: propA.id })
    .returning()
  const [structB] = await tx
    .insert(structuresTable)
    .values({ name: "Cabin B", property_id: propB.id })
    .returning()
  const [roomA] = await tx
    .insert(roomTable)
    .values({ name: "Room A", structure_id: structA.id, beds_sm: 2 })
    .returning()
  const [roomB] = await tx
    .insert(roomTable)
    .values({ name: "Room B", structure_id: structB.id, beds_sm: 2 })
    .returning()
  const [user] = await tx
    .insert(usersTable)
    .values({ name: "Guest", email: "booking-service-guest@example.test" })
    .returning()
  return { propA, propB, roomA, roomB, user }
}
