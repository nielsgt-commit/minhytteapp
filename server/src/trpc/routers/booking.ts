import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "../../db/schema/booking.schema.ts"
import {
  buildingsTable,
  roomTable,
} from "../../db/schema/property.schema.ts"
import { settlementsTable } from "../../db/schema/settlement.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  error: "expected YYYY-MM-DD",
})

const statusEnum = z.enum(["pending", "confirmed", "cancelled"])

const bookingOccupantInput = z.object({
  user_id: z.number().int().positive(),
  room_id: z.number().int().positive().nullable().optional(),
})

const bookingFields = {
  property_id: z.number().int().positive(),
  booker_id: z.number().int().positive(),
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
  ranges: Array<{ start_date: string; end_date: string }>,
) {
  const [open] = await db
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
  if (!open) return
  if (
    open.phase === "collecting_expenses"
    || open.phase === "collecting_bookings"
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
  property_id: number
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

function allocateRoom(
  room: RoomCapacity,
  adults: number,
  kids: number,
  roomLabel: string,
): BedCounts {
  const used = zeroBeds()

  const takeCot = Math.min(kids, room.travel_cot)
  used.travel_cot = takeCot
  let kidsLeft = kids - takeCot

  const takeKid = Math.min(kidsLeft, room.beds_kid)
  used.beds_kid = takeKid
  kidsLeft -= takeKid

  let sharedLeft = adults + kidsLeft

  const takeSm = Math.min(sharedLeft, room.beds_sm)
  used.beds_sm = takeSm
  sharedLeft -= takeSm

  const takeLg = Math.min(sharedLeft, room.beds_lg)
  used.beds_lg = takeLg
  sharedLeft -= takeLg

  const doubleSlots = Math.min(sharedLeft, room.beds_double * 2)
  used.beds_double = Math.ceil(doubleSlots / 2)
  sharedLeft -= doubleSlots

  const takeMat = Math.min(sharedLeft, room.mattresses)
  used.mattresses = takeMat
  sharedLeft -= takeMat

  if (sharedLeft > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `room ${roomLabel} is over capacity (${String(sharedLeft)} occupant(s) can't be placed)`,
    })
  }
  return used
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
            property_id: buildingsTable.property_id,
            beds_sm: roomTable.beds_sm,
            beds_lg: roomTable.beds_lg,
            beds_double: roomTable.beds_double,
            beds_kid: roomTable.beds_kid,
            mattresses: roomTable.mattresses,
            travel_cot: roomTable.travel_cot,
          })
          .from(roomTable)
          .innerJoin(
            buildingsTable,
            eq(buildingsTable.id, roomTable.building_id),
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

function ensureBookerIsOccupant(
  bookerId: number,
  occupants: OccupantInput[],
) {
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

function computeBookingRooms(
  occupants: OccupantInput[],
  roomById: Map<number, RoomCapacity>,
  userById: Map<number, UserRow>,
): (BedCounts & { room_id: number })[] {
  const byRoom = new Map<number, { adults: number; kids: number }>()
  for (const o of occupants) {
    if (o.room_id == null) continue
    const bucket = byRoom.get(o.room_id) ?? { adults: 0, kids: 0 }
    const user = userById.get(o.user_id)
    if (user?.is_child === true) bucket.kids += 1
    else bucket.adults += 1
    byRoom.set(o.room_id, bucket)
  }

  const out: (BedCounts & { room_id: number })[] = []
  for (const [roomId, counts] of byRoom) {
    const room = roomById.get(roomId)
    if (!room) continue
    const used = allocateRoom(
      room,
      counts.adults,
      counts.kids,
      `#${String(roomId)}`,
    )
    out.push({ room_id: roomId, ...used })
  }
  return out
}

async function loadBookings(
  db: Db,
  filter?: { property_id: number },
) {
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
  list: publicProcedure.query(async ({ ctx }) => loadBookings(ctx.db)),

  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) =>
      loadBookings(ctx.db, { property_id: input.property_id }),
    ),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      ensureBookerIsOccupant(input.booker_id, input.occupants)
      const occupants = dedupeOccupants(input.occupants)
      const { roomById, userById } = await resolveRoomsAndUsers(
        ctx.db,
        input.property_id,
        occupants,
      )
      const bookingRooms = computeBookingRooms(
        occupants,
        roomById,
        userById,
      )

      await assertBookingsUnlocked(ctx.db, input.property_id, [
        { start_date: input.start_date, end_date: input.end_date },
      ])

      return ctx.db.transaction(async tx => {
        const [created] = await tx
          .insert(bookingTable)
          .values({
            property_id: input.property_id,
            booker_id: input.booker_id,
            start_date: input.start_date,
            end_date: input.end_date,
            status: input.status,
            notes: input.notes ?? null,
            cancelled_at: input.status === "cancelled" ? new Date() : null,
            cancelled_by_id:
              input.status === "cancelled" ? input.booker_id : null,
          })
          .returning()

        if (bookingRooms.length > 0) {
          await tx
            .insert(bookingRoomsTable)
            .values(
              bookingRooms.map(r => ({ ...r, booking_id: created.id })),
            )
        }
        await tx.insert(bookingOccupantsTable).values(
          occupants.map(o => ({
            booking_id: created.id,
            user_id: o.user_id,
            room_id: o.room_id ?? null,
          })),
        )

        return created
      })
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      ensureBookerIsOccupant(input.booker_id, input.occupants)
      const occupants = dedupeOccupants(input.occupants)
      const { roomById, userById } = await resolveRoomsAndUsers(
        ctx.db,
        input.property_id,
        occupants,
      )
      const bookingRooms = computeBookingRooms(
        occupants,
        roomById,
        userById,
      )

      const [existing] = await ctx.db
        .select({
          status: bookingTable.status,
          start_date: bookingTable.start_date,
          end_date: bookingTable.end_date,
        })
        .from(bookingTable)
        .where(eq(bookingTable.id, input.id))
        .limit(1)
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" })
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
            property_id: input.property_id,
            booker_id: input.booker_id,
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
                : input.booker_id
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
          })),
        )

        return updated
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          property_id: bookingTable.property_id,
          start_date: bookingTable.start_date,
          end_date: bookingTable.end_date,
        })
        .from(bookingTable)
        .where(eq(bookingTable.id, input.id))
        .limit(1)
      if (existing && existing.property_id != null) {
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