import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "../../db/schema/booking.schema.ts"
import { structuresTable, roomTable } from "../../db/schema/property.schema.ts"
import { settlementsTable } from "../../db/schema/settlement.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  error: "expected YYYY-MM-DD",
})

const statusEnum = z.enum(["pending", "confirmed", "cancelled"])

const bookingOccupantInput = z.object({
  user_id: z.number().int().positive(),
  room_id: z.number().int().positive().nullable().optional(),
  queued: z.boolean().optional().default(false),
})

const bookingFields = {
  property_id: z.number().int().positive(),
  start_date: dateString,
  end_date: dateString,
  status: statusEnum.default("confirmed"),
  notes: z.string().max(1024).nullable().optional(),
  occupants: z.array(bookingOccupantInput).min(1, {
    error: "at least one occupant (the booker) is required",
  }),
}

const dateOrder = {
  check: (v: { start_date: string; end_date: string }) =>
    v.start_date <= v.end_date,
  error: "start_date must be on or before end_date",
  path: ["end_date"] as const,
}

const createInput = z.object(bookingFields).refine(dateOrder.check, {
  error: dateOrder.error,
  path: [...dateOrder.path],
})

const updateInput = z
  .object({ id: z.number().int().positive(), ...bookingFields })
  .refine(dateOrder.check, {
    error: dateOrder.error,
    path: [...dateOrder.path],
  })

type OccupantInput = z.infer<typeof bookingOccupantInput>

type Db = typeof dbClient

async function assertBookingsUnlocked(
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

type RoomCapacity = {
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

type UserRow = { id: number; name: string; is_child: boolean | null }

type BedCounts = {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

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

/** Total person-slots a room can hold (beds_double counts 2 slots). */
function roomTotalCapacity(room: RoomCapacity): number {
  return (
    room.travel_cot +
    room.beds_kid +
    room.beds_sm +
    room.beds_lg +
    room.beds_double * 2 +
    room.mattresses
  )
}

type AllocateRoomResult = {
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
function allocateRoom(
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

async function resolveRoomsAndUsers(
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

function ensureBookerIsOccupant(bookerId: number, occupants: OccupantInput[]) {
  if (!occupants.some(o => o.user_id === bookerId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "booker must be listed as an occupant",
    })
  }
}

function dedupeOccupants(occupants: OccupantInput[]) {
  const seen = new Set<number>()
  const out: OccupantInput[] = []
  for (const o of occupants) {
    if (seen.has(o.user_id)) continue
    seen.add(o.user_id)
    out.push(o)
  }
  return out
}

type ComputeBookingRoomsResult = {
  bookingRooms: (BedCounts & { room_id: number })[]
  overflowByRoom: Map<number, number[]>
  adultInKidOnlyByRoom: Map<number, number[]>
}

function computeBookingRooms(
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

async function loadBookings(db: Db, filter?: { property_id: number }) {
  const query = db
    .select({
      id: bookingTable.id,
      property_id: bookingTable.property_id,
      booker_id: bookingTable.booker_id,
      booker_name: usersTable.name,
      start_date: bookingTable.start_date,
      end_date: bookingTable.end_date,
      status: bookingTable.status,
      notes: bookingTable.notes,
      created_at: bookingTable.created_at,
      updated_at: bookingTable.updated_at,
      cancelled_at: bookingTable.cancelled_at,
      cancelled_by_id: bookingTable.cancelled_by_id,
    })
    .from(bookingTable)
    .leftJoin(usersTable, eq(usersTable.id, bookingTable.booker_id))

  const bookings = await (filter
    ? query
        .where(eq(bookingTable.property_id, filter.property_id))
        .orderBy(asc(bookingTable.start_date))
    : query.orderBy(asc(bookingTable.start_date)))

  if (bookings.length === 0) return []

  const ids = bookings.map(b => b.id)
  const [rooms, occupants] = await Promise.all([
    db
      .select()
      .from(bookingRoomsTable)
      .where(inArray(bookingRoomsTable.booking_id, ids)),
    db
      .select({
        booking_id: bookingOccupantsTable.booking_id,
        user_id: bookingOccupantsTable.user_id,
        user_name: usersTable.name,
        room_id: bookingOccupantsTable.room_id,
        queued: bookingOccupantsTable.queued,
      })
      .from(bookingOccupantsTable)
      .leftJoin(usersTable, eq(usersTable.id, bookingOccupantsTable.user_id))
      .where(inArray(bookingOccupantsTable.booking_id, ids)),
  ])

  return bookings.map(b => ({
    ...b,
    rooms: rooms.filter(r => r.booking_id === b.id),
    occupants: occupants.filter(o => o.booking_id === b.id),
  }))
}

export const bookingRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) =>
      loadBookings(ctx.db, { property_id: input.property_id }),
    ),

  previewConflicts: protectedProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        start_date: dateString,
        end_date: dateString,
        occupants: z.array(
          z.object({
            user_id: z.number().int().positive(),
            room_id: z.number().int().positive().nullable().optional(),
          }),
        ),
        exclude_booking_id: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        property_id,
        start_date,
        end_date,
        occupants,
        exclude_booking_id,
      } = input

      // 1. Find all overlapping non-cancelled bookings for this property
      const overlappingBookingsRaw = await ctx.db
        .select({
          id: bookingTable.id,
          booker_id: bookingTable.booker_id,
          booker_name: usersTable.name,
          start_date: bookingTable.start_date,
          end_date: bookingTable.end_date,
          status: bookingTable.status,
        })
        .from(bookingTable)
        .leftJoin(usersTable, eq(usersTable.id, bookingTable.booker_id))
        .where(
          and(
            eq(bookingTable.property_id, property_id),
            ne(bookingTable.status, "cancelled"),
            // Overlap: NOT (end_date < start_date OR start_date > end_date)
            sql`NOT (${bookingTable.end_date} < ${start_date} OR ${bookingTable.start_date} > ${end_date})`,
            exclude_booking_id != null
              ? ne(bookingTable.id, exclude_booking_id)
              : undefined,
          ),
        )

      if (overlappingBookingsRaw.length === 0 && occupants.length === 0) {
        return {
          overlappingBookings: [],
          perRoom: [],
          property: { totalCapacity: 0, totalPlaced: 0, overCapacityBy: 0 },
        }
      }

      const overlappingIds = overlappingBookingsRaw.map(b => b.id)

      // 2. Load occupants of overlapping bookings
      const existingOccupants =
        overlappingIds.length > 0
          ? await ctx.db
              .select({
                booking_id: bookingOccupantsTable.booking_id,
                user_id: bookingOccupantsTable.user_id,
                user_name: usersTable.name,
                room_id: bookingOccupantsTable.room_id,
              })
              .from(bookingOccupantsTable)
              .leftJoin(
                usersTable,
                eq(usersTable.id, bookingOccupantsTable.user_id),
              )
              .where(inArray(bookingOccupantsTable.booking_id, overlappingIds))
          : []

      // 3. Compute shared days between draft range and each overlapping booking
      function daysOverlap(
        a_start: string,
        a_end: string,
        b_start: string,
        b_end: string,
      ): number {
        const start = a_start > b_start ? a_start : b_start
        const end = a_end < b_end ? a_end : b_end
        if (start > end) return 0
        const msPerDay = 86400000
        const diff = new Date(end).getTime() - new Date(start).getTime()
        return Math.floor(diff / msPerDay) + 1
      }

      const draftUserIds = new Set(occupants.map(o => o.user_id))

      const overlappingBookings = overlappingBookingsRaw.map(b => {
        const bookingOccs = existingOccupants.filter(o => o.booking_id === b.id)
        const sharedDays = daysOverlap(
          start_date,
          end_date,
          b.start_date,
          b.end_date,
        )

        // sameUserOccupants: occupants in this overlapping booking who are ALSO in draft
        const sameUserOccupants = bookingOccs
          .filter(o => draftUserIds.has(o.user_id))
          .map(o => ({ user_id: o.user_id, user_name: o.user_name ?? "" }))

        // sharedRoomOccupants: rooms where draft occupants and existing occupants overlap
        const draftRoomIds = new Set(
          occupants.flatMap(o => (o.room_id != null ? [o.room_id] : [])),
        )
        const sharedRoomMap = new Map<
          number,
          { room_id: number; room_name: string; otherUserCount: number }
        >()
        for (const o of bookingOccs) {
          if (o.room_id == null) continue
          if (!draftRoomIds.has(o.room_id)) continue
          const existing = sharedRoomMap.get(o.room_id)
          if (existing) {
            existing.otherUserCount++
          } else {
            sharedRoomMap.set(o.room_id, {
              room_id: o.room_id,
              room_name: `Room ${String(o.room_id)}`, // name lookup done below
              otherUserCount: 1,
            })
          }
        }

        return {
          booking_id: b.id,
          booker_id: b.booker_id,
          booker_name: b.booker_name ?? "",
          start_date: b.start_date,
          end_date: b.end_date,
          status: b.status,
          sharedDays,
          sameUserOccupants,
          sharedRoomOccupants: [...sharedRoomMap.values()],
        }
      })

      // 4. Load all habitable rooms for the property for capacity calc
      const allRooms = await ctx.db
        .select({
          id: roomTable.id,
          name: roomTable.name,
          structure_id: roomTable.structure_id,
          beds_sm: roomTable.beds_sm,
          beds_lg: roomTable.beds_lg,
          beds_double: roomTable.beds_double,
          beds_kid: roomTable.beds_kid,
          mattresses: roomTable.mattresses,
          travel_cot: roomTable.travel_cot,
          structure_category: structuresTable.category,
        })
        .from(roomTable)
        .innerJoin(
          structuresTable,
          eq(structuresTable.id, roomTable.structure_id),
        )
        .where(
          and(
            eq(structuresTable.property_id, property_id),
            eq(structuresTable.category, "habitable"),
          ),
        )

      // 5. Compute per-room capacity, placed, overflow
      // Draft occupants by room
      const draftByRoom = new Map<number, number[]>() // room_id → user_ids
      for (const o of occupants) {
        if (o.room_id == null) continue
        const list = draftByRoom.get(o.room_id) ?? []
        list.push(o.user_id)
        draftByRoom.set(o.room_id, list)
      }

      // Existing occupants (from overlapping bookings) by room
      const existingByRoom = new Map<number, number[]>()
      for (const o of existingOccupants) {
        if (o.room_id == null) continue
        const list = existingByRoom.get(o.room_id) ?? []
        list.push(o.user_id)
        existingByRoom.set(o.room_id, list)
      }

      // Load user info for capacity computation
      const allUserIds = [
        ...new Set([
          ...occupants.map(o => o.user_id),
          ...existingOccupants.map(o => o.user_id),
        ]),
      ]
      const usersData =
        allUserIds.length > 0
          ? await ctx.db
              .select({
                id: usersTable.id,
                name: usersTable.name,
                is_child: usersTable.is_child,
              })
              .from(usersTable)
              .where(inArray(usersTable.id, allUserIds))
          : []
      const userMap = new Map(usersData.map(u => [u.id, u]))

      // Rooms touched by draft or existing occupants
      const touchedRoomIds = new Set([
        ...draftByRoom.keys(),
        ...existingByRoom.keys(),
      ])

      const perRoom: {
        room_id: number
        room_name: string
        capacity: number
        placedCount: number
        overCapacityBy: number
        adultInKidOnlyUserIds: number[]
      }[] = []

      for (const room of allRooms) {
        if (!touchedRoomIds.has(room.id)) continue

        const capacity = roomTotalCapacity({
          id: room.id,
          name: room.name,
          property_id: 0, // not needed here
          structure_category: room.structure_category,
          beds_sm: room.beds_sm,
          beds_lg: room.beds_lg,
          beds_double: room.beds_double,
          beds_kid: room.beds_kid,
          mattresses: room.mattresses,
          travel_cot: room.travel_cot,
        })

        const draftUserIdsForRoom = draftByRoom.get(room.id) ?? []
        const existingUserIdsForRoom = existingByRoom.get(room.id) ?? []
        const allUserIdsForRoom = [
          ...new Set([...draftUserIdsForRoom, ...existingUserIdsForRoom]),
        ]
        const placedCount = allUserIdsForRoom.length

        // Compute adult-in-kid-only: draft adults placed in rooms where shared beds are exhausted
        const draftAdultIds = draftUserIdsForRoom.filter(uid => {
          const u = userMap.get(uid)
          return u?.is_child !== true
        })
        const draftKidIds = draftUserIdsForRoom.filter(uid => {
          const u = userMap.get(uid)
          return u?.is_child === true
        })
        const roomShape = {
          id: room.id,
          name: room.name,
          property_id: 0,
          structure_category: room.structure_category,
          beds_sm: room.beds_sm,
          beds_lg: room.beds_lg,
          beds_double: room.beds_double,
          beds_kid: room.beds_kid,
          mattresses: room.mattresses,
          travel_cot: room.travel_cot,
        }
        // Run allocation with only draft occupants to detect adult-in-kid-only
        const allocResult = allocateRoom(roomShape, draftAdultIds, draftKidIds)

        perRoom.push({
          room_id: room.id,
          room_name: room.name,
          capacity,
          placedCount,
          overCapacityBy: Math.max(0, placedCount - capacity),
          adultInKidOnlyUserIds: allocResult.adultInKidOnlyUserIds,
        })
      }

      // 6. Property-level capacity
      let totalCapacity = 0
      for (const room of allRooms) {
        totalCapacity += roomTotalCapacity({
          id: room.id,
          name: room.name,
          property_id: 0,
          structure_category: room.structure_category,
          beds_sm: room.beds_sm,
          beds_lg: room.beds_lg,
          beds_double: room.beds_double,
          beds_kid: room.beds_kid,
          mattresses: room.mattresses,
          travel_cot: room.travel_cot,
        })
      }

      // Total placed = draft occupants + all occupants in overlapping bookings (unique per person)
      const allPlacedUserIds = new Set([
        ...occupants.map(o => o.user_id),
        ...existingOccupants.map(o => o.user_id),
      ])
      const totalPlaced = allPlacedUserIds.size

      return {
        overlappingBookings,
        perRoom,
        property: {
          totalCapacity,
          totalPlaced,
          overCapacityBy: Math.max(0, totalPlaced - totalCapacity),
        },
      }
    }),

  create: propertyAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const bookerId = ctx.user.id
      ensureBookerIsOccupant(bookerId, input.occupants)
      const occupants = dedupeOccupants(input.occupants)
      const { roomById, userById } = await resolveRoomsAndUsers(
        ctx.db,
        input.property_id,
        occupants,
      )
      const { bookingRooms, overflowByRoom } = computeBookingRooms(
        occupants,
        roomById,
        userById,
      )

      // Build per-occupant queued flag: if client sent queued=true, honour it;
      // otherwise infer from overflowByRoom for room-assigned occupants.
      const occupantQueued = new Map<number, boolean>()
      for (const o of occupants) {
        const clientQueued = o.queued
        const roomOverflow =
          o.room_id != null &&
          (overflowByRoom.get(o.room_id)?.includes(o.user_id) ?? false)
        occupantQueued.set(o.user_id, clientQueued || roomOverflow)
      }

      await assertBookingsUnlocked(ctx.db, input.property_id, [
        { start_date: input.start_date, end_date: input.end_date },
      ])

      return ctx.db.transaction(async tx => {
        const [created] = await tx
          .insert(bookingTable)
          .values({
            property_id: input.property_id,
            booker_id: bookerId,
            start_date: input.start_date,
            end_date: input.end_date,
            status: input.status,
            notes: input.notes ?? null,
            cancelled_at: input.status === "cancelled" ? new Date() : null,
            cancelled_by_id: input.status === "cancelled" ? bookerId : null,
          })
          .returning()

        if (bookingRooms.length > 0) {
          await tx
            .insert(bookingRoomsTable)
            .values(bookingRooms.map(r => ({ ...r, booking_id: created.id })))
        }
        await tx.insert(bookingOccupantsTable).values(
          occupants.map(o => ({
            booking_id: created.id,
            user_id: o.user_id,
            room_id: o.room_id ?? null,
            queued: occupantQueued.get(o.user_id) ?? false,
          })),
        )

        return created
      })
    }),

  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({
            status: bookingTable.status,
            start_date: bookingTable.start_date,
            end_date: bookingTable.end_date,
            property_id: bookingTable.property_id,
            booker_id: bookingTable.booker_id,
            notes: bookingTable.notes,
          })
          .from(bookingTable)
          .where(eq(bookingTable.id, input.id))
          .limit(1)
      ).at(0)
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (existing.property_id !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "cannot reassign booking to another property",
        })
      }

      const bookerId = existing.booker_id
      ensureBookerIsOccupant(bookerId, input.occupants)
      const occupants = dedupeOccupants(input.occupants)
      const { roomById, userById } = await resolveRoomsAndUsers(
        ctx.db,
        input.property_id,
        occupants,
      )
      const { bookingRooms, overflowByRoom } = computeBookingRooms(
        occupants,
        roomById,
        userById,
      )

      const occupantQueued = new Map<number, boolean>()
      for (const o of occupants) {
        const clientQueued = o.queued
        const roomOverflow =
          o.room_id != null &&
          (overflowByRoom.get(o.room_id)?.includes(o.user_id) ?? false)
        occupantQueued.set(o.user_id, clientQueued || roomOverflow)
      }

      const callerId = ctx.user.id
      if (callerId !== bookerId) {
        const existingOccupants = await ctx.db
          .select({
            user_id: bookingOccupantsTable.user_id,
            room_id: bookingOccupantsTable.room_id,
            queued: bookingOccupantsTable.queued,
          })
          .from(bookingOccupantsTable)
          .where(eq(bookingOccupantsTable.booking_id, input.id))

        const forbid = (message: string): never => {
          throw new TRPCError({ code: "FORBIDDEN", message })
        }

        if (!existingOccupants.some(o => o.user_id === callerId)) {
          forbid("only the booker can edit this booking")
        }
        if (
          input.start_date !== existing.start_date ||
          input.end_date !== existing.end_date ||
          input.status !== existing.status ||
          (input.notes ?? null) !== existing.notes
        ) {
          forbid("non-booker may only remove themselves from this booking")
        }
        if (input.occupants.some(o => o.user_id === callerId)) {
          forbid("non-booker may only remove themselves from this booking")
        }
        const expectedOthers = existingOccupants.filter(
          o => o.user_id !== callerId,
        )
        if (input.occupants.length !== expectedOthers.length) {
          forbid("non-booker may only remove themselves from this booking")
        }
        for (const e of expectedOthers) {
          const m = input.occupants.find(o => o.user_id === e.user_id)
          if (
            !m ||
            (m.room_id ?? null) !== (e.room_id ?? null) ||
            m.queued !== e.queued
          ) {
            forbid("non-booker may only remove themselves from this booking")
          }
        }
      }

      await assertBookingsUnlocked(ctx.db, input.property_id, [
        { start_date: existing.start_date, end_date: existing.end_date },
        { start_date: input.start_date, end_date: input.end_date },
      ])

      return ctx.db.transaction(async tx => {
        const wasCancelled = existing.status === "cancelled"
        const nowCancelled = input.status === "cancelled"

        const [updated] = await tx
          .update(bookingTable)
          .set({
            start_date: input.start_date,
            end_date: input.end_date,
            status: input.status,
            notes: input.notes ?? null,
            updated_at: new Date(),
            cancelled_at: nowCancelled
              ? wasCancelled
                ? undefined
                : new Date()
              : null,
            cancelled_by_id: nowCancelled
              ? wasCancelled
                ? undefined
                : bookerId
              : null,
          })
          .where(eq(bookingTable.id, input.id))
          .returning()

        await tx
          .delete(bookingRoomsTable)
          .where(eq(bookingRoomsTable.booking_id, input.id))
        if (bookingRooms.length > 0) {
          await tx
            .insert(bookingRoomsTable)
            .values(bookingRooms.map(r => ({ ...r, booking_id: input.id })))
        }

        await tx
          .delete(bookingOccupantsTable)
          .where(eq(bookingOccupantsTable.booking_id, input.id))
        await tx.insert(bookingOccupantsTable).values(
          occupants.map(o => ({
            booking_id: input.id,
            user_id: o.user_id,
            room_id: o.room_id ?? null,
            queued: occupantQueued.get(o.user_id) ?? false,
          })),
        )

        return updated
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({
            property_id: bookingTable.property_id,
            start_date: bookingTable.start_date,
            end_date: bookingTable.end_date,
          })
          .from(bookingTable)
          .where(eq(bookingTable.id, input.id))
          .limit(1)
      ).at(0)
      if (existing?.property_id != null) {
        await assertPropertyMember(ctx.db, ctx.user, existing.property_id)
        await assertBookingsUnlocked(ctx.db, existing.property_id, [
          { start_date: existing.start_date, end_date: existing.end_date },
        ])
      }
      return ctx.db.transaction(async tx => {
        await tx
          .delete(bookingRoomsTable)
          .where(eq(bookingRoomsTable.booking_id, input.id))
        await tx
          .delete(bookingOccupantsTable)
          .where(eq(bookingOccupantsTable.booking_id, input.id))
        const [deleted] = await tx
          .delete(bookingTable)
          .where(eq(bookingTable.id, input.id))
          .returning()
        return deleted
      })
    }),
})
