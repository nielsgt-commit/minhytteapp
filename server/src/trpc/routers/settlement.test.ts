// Characterization tests for the settlement mutation lifecycle: acceptSplit,
// advancePhase/regressPhase (validation, concurrency, side effects),
// markTransferPaid, booking-adjustment gating, and the legacy occupancy
// preview math. Written to pin behavior before the settlementPhase/
// settlementPreview service extraction — complements settlementGating.test.ts,
// which covers policy-driven phase gating and the reviewing expense-pull.

import { afterAll, describe, expect, it } from "vitest"
import { and, eq } from "drizzle-orm"
import { pool } from "../../db/client.ts"
import {
  bookingOccupantsTable,
  bookingTable,
} from "../../db/schema/booking.schema.ts"
import {
  propertyOwnersTable,
  propertyTable,
} from "../../db/schema/property.schema.ts"
import {
  expensesTable,
  settlementAcceptancesTable,
  settlementReviewsTable,
  settlementsTable,
} from "../../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { Temporal } from "../../shared/temporal.ts"
import { createCallerFactory } from "../init.ts"
import type { Tx } from "../test-utils.ts"
import { authUser, ctxFor, withRollback } from "../test-utils.ts"
import { appRouter } from "./_app.ts"

const createCaller = createCallerFactory(appRouter)
type Caller = ReturnType<typeof createCaller>

// Two family groups, each with one head; group A also has a plain member.
// The outsider has no membership anywhere on the property.
async function seed(tx: Tx) {
  const [prop] = await tx
    .insert(propertyTable)
    .values({ name: "Settlement Prop", address: "addr" })
    .returning()
  const users = await tx
    .insert(usersTable)
    .values([
      { name: "Head A", email: "settlement-test-head-a@example.test" },
      { name: "Head B", email: "settlement-test-head-b@example.test" },
      { name: "Member A", email: "settlement-test-member-a@example.test" },
      { name: "Outsider", email: "settlement-test-outsider@example.test" },
    ])
    .returning()
  const [headA, headB, memberA, outsider] = users
  const groups = await tx
    .insert(userGroupsTable)
    .values([
      { name: "Fam A", is_family: true, property_id: prop.id },
      { name: "Fam B", is_family: true, property_id: prop.id },
    ])
    .returning()
  const [groupA, groupB] = groups
  await tx.insert(userGroupMembersTable).values([
    { user_group_id: groupA.id, user_id: headA.id, is_head: true },
    { user_group_id: groupA.id, user_id: memberA.id, is_head: false },
    { user_group_id: groupB.id, user_id: headB.id, is_head: true },
  ])
  await tx.insert(propertyOwnersTable).values([
    { property_id: prop.id, user_group_id: groupA.id, ownership_pct: "50.00" },
    { property_id: prop.id, user_group_id: groupB.id, ownership_pct: "50.00" },
  ])
  const [settlement] = await tx
    .insert(settlementsTable)
    .values({
      property_id: prop.id,
      year: 2026,
      status: "open",
      split_policy: "occupancy_days",
      created_by_id: headA.id,
    })
    .returning()
  return { prop, headA, headB, memberA, outsider, groupA, groupB, settlement }
}

async function addBooking(
  tx: Tx,
  propertyId: number,
  bookerId: number,
  start: string,
  end: string,
) {
  const [booking] = await tx
    .insert(bookingTable)
    .values({
      property_id: propertyId,
      booker_id: bookerId,
      start_date: start,
      end_date: end,
    })
    .returning()
  await tx
    .insert(bookingOccupantsTable)
    .values({ booking_id: booking.id, user_id: bookerId })
  return booking
}

// Create a submitted expense through the router (so schema defaults apply)
// and link it straight to the settlement, as the reviewing-entry pull would.
async function addLinkedExpense(
  tx: Tx,
  caller: Caller,
  propertyId: number,
  settlementId: number,
  amount: number,
) {
  const expense = await caller.expense.create({
    property_id: propertyId,
    amount,
    date: Temporal.PlainDate.from("2026-05-01"),
    status: "submitted",
  })
  await tx
    .update(expensesTable)
    .set({ settlement_id: settlementId })
    .where(eq(expensesTable.id, expense.id))
  return expense
}

const CHAIN = [
  "collecting_expenses",
  "collecting_bookings",
  "reviewing",
  "split_policy",
] as const

async function advanceTo(
  caller: Caller,
  id: number,
  target: (typeof CHAIN)[number],
) {
  for (let i = 0; CHAIN[i] !== target; i++) {
    await caller.settlement.advancePhase({
      id,
      from: CHAIN[i],
      to: CHAIN[i + 1],
    })
  }
}

async function settlementRow(tx: Tx, id: number) {
  const [row] = await tx
    .select()
    .from(settlementsTable)
    .where(eq(settlementsTable.id, id))
    .limit(1)
  return row
}

// Deterministic close: Head A pays 1000, Head B books all 3 booking days, so
// the whole pot lands on group B and one transfer B -> A of 1000 is persisted.
async function closeWithTransfer(
  tx: Tx,
  seeded: Awaited<ReturnType<typeof seed>>,
) {
  const { prop, headA, headB, settlement } = seeded
  const callerA = createCaller(ctxFor(tx, authUser(headA)))
  const callerB = createCaller(ctxFor(tx, authUser(headB)))
  await addBooking(tx, prop.id, headB.id, "2026-06-01", "2026-06-03")
  await callerA.expense.create({
    property_id: prop.id,
    amount: 1000,
    date: Temporal.PlainDate.from("2026-05-01"),
    status: "submitted",
  })
  await advanceTo(callerA, settlement.id, "split_policy")
  await callerA.settlement.acceptSplit({ id: settlement.id })
  const closed = await callerB.settlement.acceptSplit({ id: settlement.id })
  expect(closed.closed).toBe(true)
  const summary = await callerA.settlement.getClosedSummary({
    id: settlement.id,
  })
  expect(summary.transfers).toHaveLength(1)
  return { callerA, callerB, transfer: summary.transfers[0] }
}

afterAll(async () => {
  await pool.end()
})

describe("advancePhase", () => {
  it("walks the full default chain and rejects skipping a phase", async () => {
    await withRollback(async tx => {
      const { headA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      await expect(
        caller.settlement.advancePhase({
          id: settlement.id,
          from: "collecting_expenses",
          to: "split_policy",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      for (let i = 0; i + 1 < CHAIN.length; i++) {
        const advanced = await caller.settlement.advancePhase({
          id: settlement.id,
          from: CHAIN[i],
          to: CHAIN[i + 1],
        })
        expect(advanced.phase).toBe(CHAIN[i + 1])
      }
    })
  })

  it("rejects non-head members and non-members", async () => {
    await withRollback(async tx => {
      const { memberA, outsider, settlement } = await seed(tx)
      const step = {
        id: settlement.id,
        from: "collecting_expenses",
        to: "collecting_bookings",
      } as const
      await expect(
        createCaller(ctxFor(tx, authUser(memberA))).settlement.advancePhase(
          step,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        createCaller(ctxFor(tx, authUser(outsider))).settlement.advancePhase(
          step,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("refuses a platform admin who is not a member head", async () => {
    // The strict-head distinction is deliberate: settlement participation
    // requires real membership; the admin flag must not satisfy it.
    await withRollback(async tx => {
      const { outsider, settlement } = await seed(tx)
      const admin = { ...authUser(outsider), is_admin: true }
      await expect(
        createCaller(ctxFor(tx, admin)).settlement.advancePhase({
          id: settlement.id,
          from: "collecting_expenses",
          to: "collecting_bookings",
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "only heads can advance settlement phase",
      })
    })
  })

  it("throws CONFLICT when the same step is replayed", async () => {
    await withRollback(async tx => {
      const { headA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      const step = {
        id: settlement.id,
        from: "collecting_expenses",
        to: "collecting_bookings",
      } as const
      await caller.settlement.advancePhase(step)
      await expect(caller.settlement.advancePhase(step)).rejects.toMatchObject({
        code: "CONFLICT",
      })
    })
  })

  it("pulls only heads' submitted expenses into the pot on entering review", async () => {
    await withRollback(async tx => {
      const { prop, headA, memberA, settlement } = await seed(tx)
      const headCaller = createCaller(ctxFor(tx, authUser(headA)))
      const memberCaller = createCaller(ctxFor(tx, authUser(memberA)))
      const date = Temporal.PlainDate.from("2026-05-01")
      const headExpense = await headCaller.expense.create({
        property_id: prop.id,
        amount: 300,
        date,
        status: "submitted",
      })
      const memberExpense = await memberCaller.expense.create({
        property_id: prop.id,
        amount: 200,
        date,
        status: "submitted",
      })
      await advanceTo(headCaller, settlement.id, "reviewing")
      const expenses = await headCaller.expense.listForProperty({
        property_id: prop.id,
      })
      expect(expenses.find(e => e.id === headExpense.id)?.settlement_id).toBe(
        settlement.id,
      )
      expect(
        expenses.find(e => e.id === memberExpense.id)?.settlement_id,
      ).toBeNull()
    })
  })
})

describe("regressPhase", () => {
  it("clears acceptances only when regressing out of split_policy", async () => {
    await withRollback(async tx => {
      const { headA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      await advanceTo(caller, settlement.id, "split_policy")
      const first = await caller.settlement.acceptSplit({ id: settlement.id })
      expect(first).toMatchObject({ accepted_count: 1, closed: false })

      await caller.settlement.regressPhase({
        id: settlement.id,
        from: "split_policy",
        to: "reviewing",
      })
      const acceptances = await tx
        .select()
        .from(settlementAcceptancesTable)
        .where(eq(settlementAcceptancesTable.settlement_id, settlement.id))
      expect(acceptances).toHaveLength(0)

      // Re-advancing starts the acceptance round from zero.
      await caller.settlement.advancePhase({
        id: settlement.id,
        from: "reviewing",
        to: "split_policy",
      })
      const again = await caller.settlement.acceptSplit({ id: settlement.id })
      expect(again).toMatchObject({ accepted_count: 1, closed: false })
    })
  })

  it("keeps acceptance rows when regressing from other phases", async () => {
    await withRollback(async tx => {
      const { headA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      await advanceTo(caller, settlement.id, "reviewing")
      // Synthetic row: acceptances normally exist only in split_policy, but
      // the clear must stay scoped to that phase transition.
      await tx.insert(settlementAcceptancesTable).values({
        settlement_id: settlement.id,
        head_user_id: headA.id,
      })
      await caller.settlement.regressPhase({
        id: settlement.id,
        from: "reviewing",
        to: "collecting_bookings",
      })
      const acceptances = await tx
        .select()
        .from(settlementAcceptancesTable)
        .where(eq(settlementAcceptancesTable.settlement_id, settlement.id))
      expect(acceptances).toHaveLength(1)
    })
  })

  it("rejects non-heads and throws CONFLICT on replay", async () => {
    await withRollback(async tx => {
      const { headA, memberA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      await advanceTo(caller, settlement.id, "collecting_bookings")
      const step = {
        id: settlement.id,
        from: "collecting_bookings",
        to: "collecting_expenses",
      } as const
      await expect(
        createCaller(ctxFor(tx, authUser(memberA))).settlement.regressPhase(
          step,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await caller.settlement.regressPhase(step)
      await expect(caller.settlement.regressPhase(step)).rejects.toMatchObject({
        code: "CONFLICT",
      })
    })
  })
})

describe("acceptSplit", () => {
  it("rejects outside the split_policy phase and for non-heads", async () => {
    await withRollback(async tx => {
      const { headA, memberA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      await expect(
        caller.settlement.acceptSplit({ id: settlement.id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await advanceTo(caller, settlement.id, "split_policy")
      await expect(
        createCaller(ctxFor(tx, authUser(memberA))).settlement.acceptSplit({
          id: settlement.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("closes on the last head and persists totals and transfers", async () => {
    await withRollback(async tx => {
      const seeded = await seed(tx)
      const { prop, headA, headB, memberA, groupA, groupB, settlement } = seeded
      const callerA = createCaller(ctxFor(tx, authUser(headA)))
      const callerB = createCaller(ctxFor(tx, authUser(headB)))
      // Head A pays 1000; head B books all 3 occupancy days.
      await addBooking(tx, prop.id, headB.id, "2026-06-01", "2026-06-03")
      await callerA.expense.create({
        property_id: prop.id,
        amount: 1000,
        date: Temporal.PlainDate.from("2026-05-01"),
        status: "submitted",
      })
      await advanceTo(callerA, settlement.id, "split_policy")

      const first = await callerA.settlement.acceptSplit({ id: settlement.id })
      expect(first).toMatchObject({
        accepted_count: 1,
        heads_count: 2,
        closed: false,
      })
      expect((await settlementRow(tx, settlement.id)).phase).toBe(
        "split_policy",
      )

      // Idempotent: the same head accepting again does not double-count.
      const repeat = await callerA.settlement.acceptSplit({
        id: settlement.id,
      })
      expect(repeat).toMatchObject({ accepted_count: 1, closed: false })

      const second = await callerB.settlement.acceptSplit({
        id: settlement.id,
      })
      expect(second).toMatchObject({
        accepted_count: 2,
        heads_count: 2,
        closed: true,
      })
      const row = await settlementRow(tx, settlement.id)
      expect(row.status).toBe("closed")
      expect(row.phase).toBe("closed")
      expect(row.closed_at).not.toBeNull()

      // Persisted (not recomputed) summary: whole pot on group B.
      const summary = await createCaller(
        ctxFor(tx, authUser(memberA)),
      ).settlement.getClosedSummary({ id: settlement.id })
      const totalsA = summary.groups.find(g => g.user_group_id === groupA.id)
      const totalsB = summary.groups.find(g => g.user_group_id === groupB.id)
      expect(totalsA).toMatchObject({
        total_paid: 1000,
        total_share: 0,
        net: 1000,
      })
      expect(totalsB).toMatchObject({
        total_paid: 0,
        total_share: 1000,
        net: -1000,
      })
      expect(summary.transfers).toHaveLength(1)
      expect(summary.transfers[0]).toMatchObject({
        from_group_id: groupB.id,
        to_group_id: groupA.id,
        amount: 1000,
        status: "pending",
        can_mark_paid: false, // memberA is not a head
      })
    })
  })
})

describe("markTransferPaid", () => {
  it("only a head of the recipient group can mark, idempotently", async () => {
    await withRollback(async tx => {
      const seeded = await seed(tx)
      const { memberA, outsider } = seeded
      const { callerA, callerB, transfer } = await closeWithTransfer(tx, seeded)
      // Head of the paying group is refused.
      await expect(
        callerB.settlement.markTransferPaid({ transferId: transfer.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      // A plain member of the recipient group is refused (not a head).
      await expect(
        createCaller(ctxFor(tx, authUser(memberA))).settlement.markTransferPaid(
          { transferId: transfer.id },
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      // A non-member is refused.
      await expect(
        createCaller(
          ctxFor(tx, authUser(outsider)),
        ).settlement.markTransferPaid({ transferId: transfer.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })

      const paid = await callerA.settlement.markTransferPaid({
        transferId: transfer.id,
      })
      expect(paid.status).toBe("paid")
      expect(paid.paid_at).not.toBeNull()

      // Idempotent: a second call returns the row unchanged.
      const again = await callerA.settlement.markTransferPaid({
        transferId: transfer.id,
      })
      expect(again.status).toBe("paid")
      expect(again.paid_at?.toString()).toBe(paid.paid_at?.toString())
    })
  })
})

describe("booking adjustments gating", () => {
  it("heads may edit during collecting phases, nobody afterwards", async () => {
    await withRollback(async tx => {
      const { prop, headA, headB, memberA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      const booking = await addBooking(
        tx,
        prop.id,
        headB.id,
        "2026-06-01",
        "2026-06-03",
      )
      const result = await caller.settlement.setBookingExcluded({
        settlementId: settlement.id,
        bookingId: booking.id,
        excluded: true,
      })
      expect(result.excluded).toBe(true)
      await expect(
        createCaller(
          ctxFor(tx, authUser(memberA)),
        ).settlement.setBookingExcluded({
          settlementId: settlement.id,
          bookingId: booking.id,
          excluded: false,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })

      await advanceTo(caller, settlement.id, "reviewing")
      await expect(
        caller.settlement.setBookingExcluded({
          settlementId: settlement.id,
          bookingId: booking.id,
          excluded: false,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        caller.settlement.setBookingExtras({
          settlementId: settlement.id,
          bookingId: booking.id,
          names: ["Guest"],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

describe("previewSplit legacy occupancy", () => {
  it("drops excluded bookings from the day counts", async () => {
    await withRollback(async tx => {
      const { prop, headA, headB, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      const booking = await addBooking(
        tx,
        prop.id,
        headB.id,
        "2026-06-01",
        "2026-06-03",
      )
      await addLinkedExpense(tx, caller, prop.id, settlement.id, 300)

      await caller.settlement.setBookingExcluded({
        settlementId: settlement.id,
        bookingId: booking.id,
        excluded: true,
      })
      const excluded = await caller.settlement.previewSplit({
        id: settlement.id,
      })
      expect(excluded.inputs.total_booking_days).toBe(0)

      // Upsert path: flipping the exclusion back restores the days.
      await caller.settlement.setBookingExcluded({
        settlementId: settlement.id,
        bookingId: booking.id,
        excluded: false,
      })
      const restored = await caller.settlement.previewSplit({
        id: settlement.id,
      })
      expect(restored.inputs.total_booking_days).toBe(3)
    })
  })

  it("credits extra guest names to the booker's group", async () => {
    await withRollback(async tx => {
      const { prop, headA, headB, groupB, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      const booking = await addBooking(
        tx,
        prop.id,
        headB.id,
        "2026-06-01",
        "2026-06-03",
      )
      await addLinkedExpense(tx, caller, prop.id, settlement.id, 300)
      await caller.settlement.setBookingExtras({
        settlementId: settlement.id,
        bookingId: booking.id,
        names: ["Guest"],
      })
      const preview = await caller.settlement.previewSplit({
        id: settlement.id,
      })
      // 3 occupant days + 1 extra guest x 3 days, all on the booker's group.
      expect(preview.inputs.total_booking_days).toBe(6)
      const allocB = preview.groups.find(g => g.group_id === groupB.id)
      expect(allocB?.booking_days).toBe(6)
    })
  })

  it("assigns rounding drift to the group with the most days", async () => {
    await withRollback(async tx => {
      const { prop, headA, headB, groupA, groupB, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      // Days 1 (group A) and 3 (group B) over 102 kr: raw shares 25.5 and
      // 76.5 both round up, so the sum overshoots by 1 and the drift lands
      // on group B (most days).
      await addBooking(tx, prop.id, headA.id, "2026-01-01", "2026-01-01")
      await addBooking(tx, prop.id, headB.id, "2026-06-01", "2026-06-03")
      await addLinkedExpense(tx, caller, prop.id, settlement.id, 102)
      const preview = await caller.settlement.previewSplit({
        id: settlement.id,
      })
      expect(preview.inputs.total_reimbursed).toBe(102)
      expect(preview.inputs.total_booking_days).toBe(4)
      const allocA = preview.groups.find(g => g.group_id === groupA.id)
      const allocB = preview.groups.find(g => g.group_id === groupB.id)
      expect(allocA?.total_share).toBe(26)
      expect(allocB?.total_share).toBe(76)
      expect(preview.breakdown.rounding).toEqual({
        group_id: groupB.id,
        amount: -1,
      })
      // Net: A paid 102, owes 26 -> +76; B owes the adjusted 76.
      expect(preview.transfers).toHaveLength(1)
      expect(preview.transfers[0]).toMatchObject({
        from_group_id: groupB.id,
        to_group_id: groupA.id,
        amount: 76,
      })
    })
  })
})

describe("review progress and update/delete guards", () => {
  it("setMyReviewProgress is head-only and toggles the review row", async () => {
    await withRollback(async tx => {
      const { headA, memberA, settlement } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(headA)))
      await expect(
        createCaller(
          ctxFor(tx, authUser(memberA)),
        ).settlement.setMyReviewProgress({ id: settlement.id, done: true }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })

      await caller.settlement.setMyReviewProgress({
        id: settlement.id,
        done: true,
      })
      const rowsAfterDone = await tx
        .select()
        .from(settlementReviewsTable)
        .where(
          and(
            eq(settlementReviewsTable.settlement_id, settlement.id),
            eq(settlementReviewsTable.head_user_id, headA.id),
          ),
        )
      expect(rowsAfterDone).toHaveLength(1)

      await caller.settlement.setMyReviewProgress({
        id: settlement.id,
        done: false,
      })
      const rowsAfterUndo = await tx
        .select()
        .from(settlementReviewsTable)
        .where(eq(settlementReviewsTable.settlement_id, settlement.id))
      expect(rowsAfterUndo).toHaveLength(0)
    })
  })

  it("delete is head-only and update cannot reassign the property", async () => {
    await withRollback(async tx => {
      const { headA, memberA, settlement } = await seed(tx)
      await expect(
        createCaller(ctxFor(tx, authUser(memberA))).settlement.delete({
          id: settlement.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })

      // Second property where head A is also a member, to get past the
      // membership middleware and hit the reassignment guard itself.
      const [otherProp] = await tx
        .insert(propertyTable)
        .values({ name: "Other Prop", address: "addr2" })
        .returning()
      const [otherGroup] = await tx
        .insert(userGroupsTable)
        .values({ name: "Fam C", is_family: true, property_id: otherProp.id })
        .returning()
      await tx.insert(userGroupMembersTable).values({
        user_group_id: otherGroup.id,
        user_id: headA.id,
        is_head: true,
      })
      const callerA = createCaller(ctxFor(tx, authUser(headA)))
      await expect(
        callerA.settlement.update({
          id: settlement.id,
          property_id: otherProp.id,
          year: 2026,
          status: "open",
          split_policy: "occupancy_days",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })

      const deleted = await callerA.settlement.delete({ id: settlement.id })
      expect(deleted.id).toBe(settlement.id)
    })
  })
})
