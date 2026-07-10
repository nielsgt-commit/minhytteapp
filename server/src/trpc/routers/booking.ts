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
import { usersTable } from "../../db/schema/users.schema.ts"
import {
  Temporal,
  plainDateFromDb,
  plainDateToDbString,
  zPlainDate,
} from "../../shared/temporal.ts"
import { wireMap } from "../util/wire.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import { roomTotalCapacity } from "../../shared/bedOccupancy.ts"
import {
  allocateRoom,
  assertBookingsUnlocked,
  computeBookingRooms,
  computeOccupantQueued,
  dedupeOccupants,
  occupantRowValues,
  resolveRoomsAndUsers,
} from "../../services/booking.ts"

const statusEnum = z.enum(["pending", "confirmed", "cancelled"])

const bookingOccupantInput = z.object({
  user_id: z.number().int().positive(),
  room_id: z.number().int().positive().nullable().optional(),
  queued: z.boolean().optional().default(false),
  sleeps_separately: z.boolean().optional().default(false),
})

const bookingFields = {
  property_id: z.number().int().positive(),
  start_date: zPlainDate,
  end_date: zPlainDate,
  status: statusEnum.default("confirmed"),
  notes: z.string().max(1024).nullable().optional(),
  occupants: z.array(bookingOccupantInput).min(1, {
    error: "at least one occupant is required",
  }),
}

const dateOrder = {
  check: (v: {
    start_date: Temporal.PlainDate
    end_date: Temporal.PlainDate
  }) => Temporal.PlainDate.compare(v.start_date, v.end_date) <= 0,
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

type Db = typeof dbClient

// Wire mapping: drizzle `date` columns are "YYYY-MM-DD" strings and
// `timestamp` columns are JS Dates — convert to Temporal at the handler edge.
const toWireBooking = wireMap({
  start_date: "plainDate",
  end_date: "plainDate",
  created_at: "instant",
  updated_at: "instant",
  cancelled_at: "instantOrNull",
})

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
        // Children aren't family-group members; their primary parent's id lets
        // the client color a child's stay with the parent's group.
        parent_user_id: usersTable.parent_user_id,
        room_id: bookingOccupantsTable.room_id,
        queued: bookingOccupantsTable.queued,
        sleeps_separately: bookingOccupantsTable.sleeps_separately,
      })
      .from(bookingOccupantsTable)
      .leftJoin(usersTable, eq(usersTable.id, bookingOccupantsTable.user_id))
      .where(inArray(bookingOccupantsTable.booking_id, ids)),
  ])

  return bookings.map(b => ({
    ...toWireBooking(b),
    rooms: rooms.filter(r => r.booking_id === b.id),
    occupants: occupants.filter(o => o.booking_id === b.id),
  }))
}

export const bookingRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      return loadBookings(ctx.db, { property_id: input.property_id })
    }),

  previewConflicts: protectedProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        start_date: zPlainDate,
        end_date: zPlainDate,
        occupants: z.array(
          z.object({
            user_id: z.number().int().positive(),
            room_id: z.number().int().positive().nullable().optional(),
            sleeps_separately: z.boolean().optional(),
          }),
        ),
        exclude_booking_id: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { property_id, occupants, exclude_booking_id } = input
      // DB-side range filters and overlap math stay string-based.
      const start_date = plainDateToDbString(input.start_date)
      const end_date = plainDateToDbString(input.end_date)

      await assertPropertyMember(ctx.db, ctx.user, property_id)

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
                sleeps_separately: bookingOccupantsTable.sleeps_separately,
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
          start_date: plainDateFromDb(b.start_date),
          end_date: plainDateFromDb(b.end_date),
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

        const capacity = roomTotalCapacity(room)

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
        totalCapacity += roomTotalCapacity(room)
      }

      // Total placed = draft occupants + all occupants in overlapping bookings
      // (unique per person).  Occupants who sleep separately (e.g. own tent)
      // don't consume property bed capacity.
      const allPlacedUserIds = new Set([
        ...occupants.filter(o => !o.sleeps_separately).map(o => o.user_id),
        ...existingOccupants
          .filter(o => !o.sleeps_separately)
          .map(o => o.user_id),
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

      const occupantQueued = computeOccupantQueued(occupants, overflowByRoom)

      const startDate = plainDateToDbString(input.start_date)
      const endDate = plainDateToDbString(input.end_date)
      await assertBookingsUnlocked(ctx.db, input.property_id, [
        { start_date: startDate, end_date: endDate },
      ])

      return ctx.db.transaction(async tx => {
        const [created] = await tx
          .insert(bookingTable)
          .values({
            property_id: input.property_id,
            booker_id: bookerId,
            start_date: startDate,
            end_date: endDate,
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
        await tx
          .insert(bookingOccupantsTable)
          .values(occupantRowValues(created.id, occupants, occupantQueued))

        return toWireBooking(created)
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

      const startDate = plainDateToDbString(input.start_date)
      const endDate = plainDateToDbString(input.end_date)

      const bookerId = existing.booker_id
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

      const occupantQueued = computeOccupantQueued(occupants, overflowByRoom)

      const callerId = ctx.user.id
      if (callerId !== bookerId) {
        const existingOccupants = await ctx.db
          .select({
            user_id: bookingOccupantsTable.user_id,
            room_id: bookingOccupantsTable.room_id,
            queued: bookingOccupantsTable.queued,
            sleeps_separately: bookingOccupantsTable.sleeps_separately,
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
          startDate !== existing.start_date ||
          endDate !== existing.end_date ||
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
            m.queued !== e.queued ||
            m.sleeps_separately !== e.sleeps_separately
          ) {
            forbid("non-booker may only remove themselves from this booking")
          }
        }
      }

      await assertBookingsUnlocked(ctx.db, input.property_id, [
        { start_date: existing.start_date, end_date: existing.end_date },
        { start_date: startDate, end_date: endDate },
      ])

      return ctx.db.transaction(async tx => {
        const wasCancelled = existing.status === "cancelled"
        const nowCancelled = input.status === "cancelled"

        const [updated] = await tx
          .update(bookingTable)
          .set({
            start_date: startDate,
            end_date: endDate,
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
        await tx
          .insert(bookingOccupantsTable)
          .values(occupantRowValues(input.id, occupants, occupantQueued))

        return toWireBooking(updated)
      })
    }),

  transferBooker: propertyAdminProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        id: z.number().int().positive(),
        new_booker_id: z.number().int().positive(),
        remove_self: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({
            property_id: bookingTable.property_id,
            booker_id: bookingTable.booker_id,
            status: bookingTable.status,
            start_date: bookingTable.start_date,
            end_date: bookingTable.end_date,
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
          message: "booking belongs to another property",
        })
      }
      const callerId = ctx.user.id
      if (callerId !== existing.booker_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only the booker can hand over this booking",
        })
      }
      if (existing.status === "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cannot hand over a cancelled booking",
        })
      }
      if (input.new_booker_id === existing.booker_id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "new booker must be a different user",
        })
      }

      const existingOccupants = await ctx.db
        .select({
          user_id: bookingOccupantsTable.user_id,
          room_id: bookingOccupantsTable.room_id,
          queued: bookingOccupantsTable.queued,
          sleeps_separately: bookingOccupantsTable.sleeps_separately,
        })
        .from(bookingOccupantsTable)
        .where(eq(bookingOccupantsTable.booking_id, input.id))

      if (!existingOccupants.some(o => o.user_id === input.new_booker_id)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "new booker must be an occupant of the booking",
        })
      }
      const newBooker = (
        await ctx.db
          .select({ is_child: usersTable.is_child })
          .from(usersTable)
          .where(eq(usersTable.id, input.new_booker_id))
          .limit(1)
      ).at(0)
      if (newBooker?.is_child === true) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "a child cannot be responsible for a booking",
        })
      }

      await assertBookingsUnlocked(ctx.db, input.property_id, [
        { start_date: existing.start_date, end_date: existing.end_date },
      ])

      const remaining = input.remove_self
        ? existingOccupants.filter(o => o.user_id !== callerId)
        : existingOccupants
      if (remaining.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "at least one occupant is required",
        })
      }
      const rewriteOccupants = remaining.length !== existingOccupants.length

      // Removing an occupant frees beds, so recompute the derived room
      // allocation the same way `update` does.
      const occupants = remaining.map(o => ({
        user_id: o.user_id,
        room_id: o.room_id,
        queued: o.queued,
        sleeps_separately: o.sleeps_separately,
      }))
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
      const occupantQueued = computeOccupantQueued(occupants, overflowByRoom)

      return ctx.db.transaction(async tx => {
        const [updated] = await tx
          .update(bookingTable)
          .set({
            booker_id: input.new_booker_id,
            updated_at: new Date(),
          })
          .where(eq(bookingTable.id, input.id))
          .returning()

        if (rewriteOccupants) {
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
          await tx
            .insert(bookingOccupantsTable)
            .values(occupantRowValues(input.id, occupants, occupantQueued))
        }

        return toWireBooking(updated)
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
        // No existence check above, so the delete may match nothing.
        const deleted = (
          await tx
            .delete(bookingTable)
            .where(eq(bookingTable.id, input.id))
            .returning()
        ).at(0)
        return deleted ? toWireBooking(deleted) : deleted
      })
    }),
})
