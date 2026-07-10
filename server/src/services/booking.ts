// Booking allocation domain logic: the settlement-driven booking lock, bed
// allocation within a room, occupant/room resolution and validation, and the
// derived per-room bed usage. Extracted verbatim from
// trpc/routers/booking.ts — the router keeps zod input validation, authz,
// wire mapping, and the transactional write orchestration.
//
// Server-only: this module touches drizzle tables and throws TRPCError, so it
// must never be imported from server/src/shared (the isomorphic kernel).

import { TRPCError } from "@trpc/server"
import { and, eq, inArray } from "drizzle-orm"
import type { db as dbClient } from "../db/client.ts"
import { structuresTable, roomTable } from "../db/schema/property.schema.ts"
import { settlementsTable } from "../db/schema/settlement.schema.ts"
import { usersTable } from "../db/schema/users.schema.ts"
import type { BedCounts } from "../shared/bedOccupancy.ts"

type Db = typeof dbClient

// Structural mirror of the router's zod occupant input (its defaults make
// queued/sleeps_separately required in the parsed output). Defined here so
// the service never depends on the router's zod schemas.
export type OccupantInput = {
  user_id: number
  room_id?: number | null
  queued: boolean
  sleeps_separately: boolean
}

export async function assertBookingsUnlocked(
  db: Db,
  propertyId: number,
  ranges: { start_date: string; end_date: string }[],
) {
  const open = (
    await db
      .select({
        year: settlementsTable.year,
        phase: settlementsTable.phase,
      })
      .from(settlementsTable)
      .where(
        and(
          eq(settlementsTable.property_id, propertyId),
          eq(settlementsTable.status, "open"),
        ),
      )
      .limit(1)
  ).at(0)
  if (!open) return
  if (
    open.phase === "collecting_expenses" ||
    open.phase === "collecting_bookings"
  ) {
    return
  }
  const yearStart = `${String(open.year)}-01-01`
  const yearEnd = `${String(open.year)}-12-31`
  const overlaps = ranges.some(
    r => !(r.end_date < yearStart || r.start_date > yearEnd),
  )
  if (overlaps) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "bookings are locked: the open settlement for this year is in or past review",
    })
  }
}

export type RoomCapacity = {
  id: number
  name: string
  property_id: number
  structure_category: string | null
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

export type UserRow = { id: number; name: string; is_child: boolean | null }

function zeroBeds(): BedCounts {
  return {
    beds_sm: 0,
    beds_lg: 0,
    beds_double: 0,
    beds_kid: 0,
    mattresses: 0,
    travel_cot: 0,
  }
}

export type AllocateRoomResult = {
  used: BedCounts
  /** user_ids that couldn't be placed (overflow) */
  overflowUserIds: number[]
  /** adults whose only remaining beds are kid-only */
  adultInKidOnlyUserIds: number[]
}

/**
 * Allocate beds in a single room.  NEVER throws on overflow — excess occupants
 * are returned in overflowUserIds.  Adults placed when only kid-only beds remain
 * are flagged in adultInKidOnlyUserIds.
 *
 * Allocation order (per spec):
 *   Kids: travel_cot → beds_kid → shared (beds_sm, beds_lg, beds_double, mattresses)
 *   Adults: shared beds only
 */
export function allocateRoom(
  room: RoomCapacity,
  adultIds: number[],
  kidIds: number[],
): AllocateRoomResult {
  const used = zeroBeds()
  const overflowUserIds: number[] = []
  const adultInKidOnlyUserIds: number[] = []

  let cotsLeft = room.travel_cot
  let kidBedsLeft = room.beds_kid
  let smLeft = room.beds_sm
  let lgLeft = room.beds_lg
  let doubleLeft = room.beds_double * 2 // person-slots
  let matLeft = room.mattresses

  // -- Place kids first --
  for (const kidId of kidIds) {
    if (cotsLeft > 0) {
      cotsLeft--
      used.travel_cot++
    } else if (kidBedsLeft > 0) {
      kidBedsLeft--
      used.beds_kid++
    } else if (smLeft > 0) {
      smLeft--
      used.beds_sm++
    } else if (lgLeft > 0) {
      lgLeft--
      used.beds_lg++
    } else if (doubleLeft > 0) {
      doubleLeft--
      used.beds_double = Math.ceil((room.beds_double * 2 - doubleLeft) / 2)
    } else if (matLeft > 0) {
      matLeft--
      used.mattresses++
    } else {
      overflowUserIds.push(kidId)
    }
  }

  // -- Place adults (shared beds only) --
  for (const adultId of adultIds) {
    // Check if remaining shared capacity > 0
    const sharedRemaining = smLeft + lgLeft + doubleLeft + matLeft
    // Also track if only kid-only beds would be left for this adult
    if (sharedRemaining === 0 && (cotsLeft > 0 || kidBedsLeft > 0)) {
      // Adult is being placed but only kid-only beds remain
      adultInKidOnlyUserIds.push(adultId)
      overflowUserIds.push(adultId) // treat as overflow since they can't use kid-only beds
    } else if (smLeft > 0) {
      smLeft--
      used.beds_sm++
    } else if (lgLeft > 0) {
      lgLeft--
      used.beds_lg++
    } else if (doubleLeft > 0) {
      doubleLeft--
      used.beds_double = Math.ceil((room.beds_double * 2 - doubleLeft) / 2)
    } else if (matLeft > 0) {
      matLeft--
      used.mattresses++
    } else {
      overflowUserIds.push(adultId)
    }
  }

  return { used, overflowUserIds, adultInKidOnlyUserIds }
}

export async function resolveRoomsAndUsers(
  db: Db,
  propertyId: number,
  occupants: OccupantInput[],
) {
  const roomIds = new Set<number>()
  for (const o of occupants) {
    if (o.room_id != null) roomIds.add(o.room_id)
  }
  const userIds = [...new Set(occupants.map(o => o.user_id))]

  const [rooms, users] = await Promise.all([
    roomIds.size > 0
      ? db
          .select({
            id: roomTable.id,
            name: roomTable.name,
            property_id: structuresTable.property_id,
            structure_category: structuresTable.category,
            beds_sm: roomTable.beds_sm,
            beds_lg: roomTable.beds_lg,
            beds_double: roomTable.beds_double,
            beds_kid: roomTable.beds_kid,
            mattresses: roomTable.mattresses,
            travel_cot: roomTable.travel_cot,
          })
          .from(roomTable)
          .innerJoin(
            structuresTable,
            eq(structuresTable.id, roomTable.structure_id),
          )
          .where(inArray(roomTable.id, Array.from(roomIds)))
      : Promise.resolve([] as RoomCapacity[]),
    db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        is_child: usersTable.is_child,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds)),
  ])

  const roomById = new Map(rooms.map(r => [r.id, r]))
  for (const id of roomIds) {
    const row = roomById.get(id)
    if (!row) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `room ${String(id)} not found`,
      })
    }
    if (row.property_id !== propertyId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `room ${String(id)} does not belong to property ${String(propertyId)}`,
      })
    }
  }

  const userById = new Map<number, UserRow>(users.map(u => [u.id, u]))
  for (const id of userIds) {
    if (!userById.has(id)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `user ${String(id)} not found`,
      })
    }
  }

  return { roomById, userById }
}

export function dedupeOccupants<T extends OccupantInput>(occupants: T[]): T[] {
  const seen = new Set<number>()
  const out: T[] = []
  for (const o of occupants) {
    if (seen.has(o.user_id)) continue
    seen.add(o.user_id)
    out.push(o)
  }
  return out
}

export type ComputeBookingRoomsResult = {
  bookingRooms: (BedCounts & { room_id: number })[]
  overflowByRoom: Map<number, number[]>
  adultInKidOnlyByRoom: Map<number, number[]>
}

export function computeBookingRooms(
  occupants: OccupantInput[],
  roomById: Map<number, RoomCapacity>,
  userById: Map<number, UserRow>,
): ComputeBookingRoomsResult {
  const byRoom = new Map<number, { adultIds: number[]; kidIds: number[] }>()
  for (const o of occupants) {
    if (o.room_id == null) continue
    const bucket = byRoom.get(o.room_id) ?? { adultIds: [], kidIds: [] }
    const user = userById.get(o.user_id)
    if (user?.is_child === true) bucket.kidIds.push(o.user_id)
    else bucket.adultIds.push(o.user_id)
    byRoom.set(o.room_id, bucket)
  }

  const bookingRooms: (BedCounts & { room_id: number })[] = []
  const overflowByRoom = new Map<number, number[]>()
  const adultInKidOnlyByRoom = new Map<number, number[]>()

  for (const [roomId, counts] of byRoom) {
    const room = roomById.get(roomId)
    if (!room) continue
    const result = allocateRoom(room, counts.adultIds, counts.kidIds)
    bookingRooms.push({ room_id: roomId, ...result.used })
    if (result.overflowUserIds.length > 0) {
      overflowByRoom.set(roomId, result.overflowUserIds)
    }
    if (result.adultInKidOnlyUserIds.length > 0) {
      adultInKidOnlyByRoom.set(roomId, result.adultInKidOnlyUserIds)
    }
  }

  return { bookingRooms, overflowByRoom, adultInKidOnlyByRoom }
}

// Per-occupant queued flag: honour an explicit queued=true from the client,
// otherwise infer it from the room-overflow allocation.
export function computeOccupantQueued(
  occupants: OccupantInput[],
  overflowByRoom: Map<number, number[]>,
): Map<number, boolean> {
  const occupantQueued = new Map<number, boolean>()
  for (const o of occupants) {
    const roomOverflow =
      o.room_id != null &&
      (overflowByRoom.get(o.room_id)?.includes(o.user_id) ?? false)
    occupantQueued.set(o.user_id, o.queued || roomOverflow)
  }
  return occupantQueued
}

// Insert values for booking_occupants: sleeping separately means no room
// hold at all (no room, never queued).
export function occupantRowValues(
  bookingId: number,
  occupants: OccupantInput[],
  occupantQueued: Map<number, boolean>,
) {
  return occupants.map(o => ({
    booking_id: bookingId,
    user_id: o.user_id,
    room_id: o.sleeps_separately ? null : (o.room_id ?? null),
    queued: o.sleeps_separately
      ? false
      : (occupantQueued.get(o.user_id) ?? false),
    sleeps_separately: o.sleeps_separately,
  }))
}
