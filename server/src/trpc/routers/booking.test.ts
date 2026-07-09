import { afterAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { db, pool } from "../../db/client.ts"
import { bookingOccupantsTable } from "../../db/schema/booking.schema.ts"
import {
  propertyOwnersTable,
  propertyTable,
  roomTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { Temporal } from "../../shared/temporal.ts"
import type { AuthUser, Context } from "../context.ts"
import { createCallerFactory } from "../init.ts"
import { appRouter } from "./_app.ts"

// The booker is intentionally NOT required to be an occupant: she may book on
// behalf of others, remove herself later, or hand the booking over entirely.

const createCaller = createCallerFactory(appRouter)

function authUser(row: { id: number; name: string; email: string }): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: true,
    image: null,
    is_admin: false,
    is_head_anywhere: false,
    is_head: false,
    is_child: false,
    parent_user_id: null,
    birthday: null,
    onboarding_step: null,
    onboarding_dismissed_at: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function ctxFor(tx: Tx, user: AuthUser): Context {
  return { db: tx, session: null, user } as unknown as Context
}

async function seed(tx: Tx) {
  const [prop] = await tx
    .insert(propertyTable)
    .values({ name: "Booking Prop", address: "addr" })
    .returning()
  const [anna] = await tx
    .insert(usersTable)
    .values({ name: "Anna", email: "booking-test-anna@example.test" })
    .returning()
  const [bjorn] = await tx
    .insert(usersTable)
    .values({ name: "Bjørn", email: "booking-test-bjorn@example.test" })
    .returning()
  const [kid] = await tx
    .insert(usersTable)
    .values({
      name: "Kid",
      email: "booking-test-kid@example.test",
      is_child: true,
    })
    .returning()
  const [group] = await tx
    .insert(userGroupsTable)
    .values({ name: "Fam", is_family: true, property_id: prop.id })
    .returning()
  await tx.insert(userGroupMembersTable).values([
    { user_group_id: group.id, user_id: anna.id, is_head: true },
    { user_group_id: group.id, user_id: bjorn.id, is_head: false },
  ])
  await tx.insert(propertyOwnersTable).values({
    property_id: prop.id,
    user_group_id: group.id,
    ownership_pct: "100.00",
  })
  return { prop, anna, bjorn, kid }
}

class Rollback extends Error {}

async function withRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(async tx => {
      await fn(tx)
      throw new Rollback()
    })
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
  }
}

afterAll(async () => {
  await pool.end()
})

const START = Temporal.PlainDate.from("2030-07-01")
const END = Temporal.PlainDate.from("2030-07-05")

function occ(user_id: number) {
  return { user_id, room_id: null, queued: false, sleeps_separately: false }
}

async function occupantIds(tx: Tx, bookingId: number) {
  const rows = await tx
    .select({ user_id: bookingOccupantsTable.user_id })
    .from(bookingOccupantsTable)
    .where(eq(bookingOccupantsTable.booking_id, bookingId))
  return rows.map(r => r.user_id).sort((a, b) => a - b)
}

describe("booker need not be an occupant", () => {
  it("creates a booking whose occupants exclude the booker", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      const created = await caller.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(bjorn.id)],
      })
      expect(created.booker_id).toBe(anna.id)
      expect(await occupantIds(tx, created.id)).toEqual([bjorn.id])
    })
  })

  it("lets the booker remove herself via update", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      const created = await caller.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(anna.id), occ(bjorn.id)],
      })
      await caller.booking.update({
        id: created.id,
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(bjorn.id)],
      })
      expect(await occupantIds(tx, created.id)).toEqual([bjorn.id])
    })
  })

  it("still requires at least one occupant", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      await expect(
        caller.booking.create({
          property_id: prop.id,
          start_date: START,
          end_date: END,
          occupants: [],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const created = await caller.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(bjorn.id)],
      })
      await expect(
        caller.booking.update({
          id: created.id,
          property_id: prop.id,
          start_date: START,
          end_date: END,
          occupants: [],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })

  it("non-booker occupant can still remove themselves when the booker is absent", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn, kid } = await seed(tx)
      const asAnna = createCaller(ctxFor(tx, authUser(anna)))
      const created = await asAnna.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(bjorn.id), occ(kid.id)],
      })
      const asBjorn = createCaller(ctxFor(tx, authUser(bjorn)))
      await asBjorn.booking.update({
        id: created.id,
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(kid.id)],
      })
      expect(await occupantIds(tx, created.id)).toEqual([kid.id])
    })
  })
})

describe("booking.bedAvailabilityToday", () => {
  async function seedRoom(tx: Tx, propertyId: number) {
    const [structure] = await tx
      .insert(structuresTable)
      .values({ property_id: propertyId, name: "Main cabin" })
      .returning()
    const [room] = await tx
      .insert(roomTable)
      .values({
        structure_id: structure.id,
        name: "North room",
        beds_sm: 2,
        beds_double: 1,
      })
      .returning()
    return { structure, room }
  }

  it("counts occupants of bookings covering today against room capacity", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn } = await seed(tx)
      const { room } = await seedRoom(tx, prop.id)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      const today = Temporal.Now.plainDateISO()
      await caller.booking.create({
        property_id: prop.id,
        start_date: today,
        end_date: today.add({ days: 2 }),
        occupants: [
          { ...occ(anna.id), room_id: room.id },
          occ(bjorn.id), // stays but has no room yet
        ],
      })
      const res = await caller.booking.bedAvailabilityToday({
        property_id: prop.id,
      })
      expect(res.rooms).toHaveLength(1)
      expect(res.rooms[0]).toMatchObject({
        room_id: room.id,
        name: "North room",
        structure_name: "Main cabin",
        capacity: 4, // 2 single + 1 double (2 slots)
        occupied: 1,
        available: 3,
      })
      expect(res.unassignedGuests).toBe(1)
    })
  })

  it("ignores bookings outside today and queued occupants", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn, kid } = await seed(tx)
      const { room } = await seedRoom(tx, prop.id)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      // Future booking: must not count.
      await caller.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [{ ...occ(anna.id), room_id: room.id }],
      })
      // Current booking with a queued (waitlisted) occupant: only the placed
      // occupant holds a bed.
      const today = Temporal.Now.plainDateISO()
      await caller.booking.create({
        property_id: prop.id,
        start_date: today,
        end_date: today,
        occupants: [
          { ...occ(bjorn.id), room_id: room.id },
          { ...occ(kid.id), room_id: room.id, queued: true },
        ],
      })
      const res = await caller.booking.bedAvailabilityToday({
        property_id: prop.id,
      })
      expect(res.rooms[0]).toMatchObject({ occupied: 1, available: 3 })
      expect(res.unassignedGuests).toBe(0)
    })
  })
})

describe("booking.transferBooker", () => {
  it("hands the booking over to an adult occupant, optionally removing the caller", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      const created = await caller.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(anna.id), occ(bjorn.id)],
      })
      const transferred = await caller.booking.transferBooker({
        property_id: prop.id,
        id: created.id,
        new_booker_id: bjorn.id,
        remove_self: true,
      })
      expect(transferred.booker_id).toBe(bjorn.id)
      expect(await occupantIds(tx, created.id)).toEqual([bjorn.id])
    })
  })

  it("keeps the caller as occupant without remove_self", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      const created = await caller.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(anna.id), occ(bjorn.id)],
      })
      const transferred = await caller.booking.transferBooker({
        property_id: prop.id,
        id: created.id,
        new_booker_id: bjorn.id,
      })
      expect(transferred.booker_id).toBe(bjorn.id)
      expect(await occupantIds(tx, created.id)).toEqual(
        [anna.id, bjorn.id].sort((a, b) => a - b),
      )
    })
  })

  it("only the booker may hand over", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn } = await seed(tx)
      const asAnna = createCaller(ctxFor(tx, authUser(anna)))
      const created = await asAnna.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(anna.id), occ(bjorn.id)],
      })
      const asBjorn = createCaller(ctxFor(tx, authUser(bjorn)))
      await expect(
        asBjorn.booking.transferBooker({
          property_id: prop.id,
          id: created.id,
          new_booker_id: bjorn.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("rejects a new booker who is not an occupant or is a child", async () => {
    await withRollback(async tx => {
      const { prop, anna, bjorn, kid } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(anna)))
      const created = await caller.booking.create({
        property_id: prop.id,
        start_date: START,
        end_date: END,
        occupants: [occ(anna.id), occ(kid.id)],
      })
      await expect(
        caller.booking.transferBooker({
          property_id: prop.id,
          id: created.id,
          new_booker_id: bjorn.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        caller.booking.transferBooker({
          property_id: prop.id,
          id: created.id,
          new_booker_id: kid.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })
})
