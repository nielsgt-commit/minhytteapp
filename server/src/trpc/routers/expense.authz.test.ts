import { afterAll, describe, expect, it } from "vitest"
import { db, pool } from "../../db/client.ts"
import {
  propertyOwnersTable,
  propertyTable,
} from "../../db/schema/property.schema.ts"
import { settlementsTable } from "../../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { Temporal } from "../../shared/temporal.ts"
import type { AuthUser, Context } from "../context.ts"
import { createCallerFactory } from "../init.ts"
import { appRouter } from "./_app.ts"

// expense.create/update/delete run under propertyAdminProcedure, which only
// asserts membership. Approving (reimbursed), rejecting, or touching an
// already-reimbursed expense is a head-only review action — enforced in the
// router since authz is app-layer with no RLS. These tests pin that boundary.

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
    .values({ name: "Authz Prop", address: "addr" })
    .returning()
  const [head] = await tx
    .insert(usersTable)
    .values({ name: "Head", email: "expense-authz-head@example.test" })
    .returning()
  const [member] = await tx
    .insert(usersTable)
    .values({ name: "Member", email: "expense-authz-member@example.test" })
    .returning()
  const [group] = await tx
    .insert(userGroupsTable)
    .values({ name: "Fam", is_family: true, property_id: prop.id })
    .returning()
  await tx.insert(userGroupMembersTable).values([
    { user_group_id: group.id, user_id: head.id, is_head: true },
    { user_group_id: group.id, user_id: member.id, is_head: false },
  ])
  await tx.insert(propertyOwnersTable).values({
    property_id: prop.id,
    user_group_id: group.id,
    ownership_pct: "100.00",
  })
  return { prop, head, member }
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

const aDate = Temporal.PlainDate.from("2026-05-01")

describe("expense review authz", () => {
  it("lets a non-head member create and keep their own submitted expense", async () => {
    await withRollback(async tx => {
      const { prop, member } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const created = await caller.expense.create({
        property_id: prop.id,
        amount: 500,
        date: aDate,
        status: "submitted",
      })
      expect(created.status).toBe("submitted")
      expect(created.payer_id).toBe(member.id)
    })
  })

  it("forbids a non-head member from reimbursing an expense", async () => {
    await withRollback(async tx => {
      const { prop, head, member } = await seed(tx)
      const memberCaller = createCaller(ctxFor(tx, authUser(member)))
      const created = await memberCaller.expense.create({
        property_id: prop.id,
        amount: 500,
        date: aDate,
        status: "submitted",
      })
      await expect(
        memberCaller.expense.update({
          id: created.id,
          property_id: prop.id,
          amount: 500,
          date: aDate,
          status: "reimbursed",
          reimbursed_by_id: head.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("lets a head reimburse a member's submitted expense", async () => {
    await withRollback(async tx => {
      const { prop, head, member } = await seed(tx)
      const memberCaller = createCaller(ctxFor(tx, authUser(member)))
      const created = await memberCaller.expense.create({
        property_id: prop.id,
        amount: 500,
        date: aDate,
        status: "submitted",
      })
      const headCaller = createCaller(ctxFor(tx, authUser(head)))
      const reimbursed = await headCaller.expense.update({
        id: created.id,
        property_id: prop.id,
        amount: 500,
        date: aDate,
        status: "reimbursed",
        reimbursed_by_id: head.id,
      })
      expect(reimbursed.status).toBe("reimbursed")
    })
  })

  it("forbids a non-head member from creating an already-reimbursed expense", async () => {
    await withRollback(async tx => {
      const { prop, head, member } = await seed(tx)
      const memberCaller = createCaller(ctxFor(tx, authUser(member)))
      await expect(
        memberCaller.expense.create({
          property_id: prop.id,
          amount: 500,
          date: aDate,
          status: "reimbursed",
          reimbursed_by_id: head.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("forbids a non-head member from editing or deleting a reimbursed expense", async () => {
    await withRollback(async tx => {
      const { prop, head, member } = await seed(tx)
      const memberCaller = createCaller(ctxFor(tx, authUser(member)))
      const created = await memberCaller.expense.create({
        property_id: prop.id,
        amount: 500,
        date: aDate,
        status: "submitted",
      })
      const headCaller = createCaller(ctxFor(tx, authUser(head)))
      await headCaller.expense.update({
        id: created.id,
        property_id: prop.id,
        amount: 500,
        date: aDate,
        status: "reimbursed",
        reimbursed_by_id: head.id,
      })
      // un-reimbursing back to submitted
      await expect(
        memberCaller.expense.update({
          id: created.id,
          property_id: prop.id,
          amount: 500,
          date: aDate,
          status: "submitted",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        memberCaller.expense.delete({ id: created.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

// Once the open settlement is past collecting, submitted expenses are locked —
// except for heads during the reviewing phase, who toggle their own submitted
// expenses in and out of the settlement from the review screen.
describe("expense settlement lock", () => {
  async function seedReviewingSettlement(tx: Tx, propertyId: number) {
    const [settlement] = await tx
      .insert(settlementsTable)
      .values({
        property_id: propertyId,
        year: 2026,
        status: "open",
        phase: "reviewing",
        split_policy: "occupancy_days",
      })
      .returning()
    return settlement
  }

  it("lets a head toggle their submitted expense's settlement link while reviewing", async () => {
    await withRollback(async tx => {
      const { prop, head } = await seed(tx)
      const settlement = await seedReviewingSettlement(tx, prop.id)
      const headCaller = createCaller(ctxFor(tx, authUser(head)))
      const created = await headCaller.expense.create({
        property_id: prop.id,
        amount: 700,
        date: aDate,
        status: "submitted",
      })
      const linked = await headCaller.expense.update({
        id: created.id,
        property_id: prop.id,
        amount: 700,
        date: aDate,
        status: "submitted",
        settlement_id: settlement.id,
      })
      expect(linked.settlement_id).toBe(settlement.id)
      const unlinked = await headCaller.expense.update({
        id: created.id,
        property_id: prop.id,
        amount: 700,
        date: aDate,
        status: "submitted",
        settlement_id: null,
      })
      expect(unlinked.settlement_id).toBeNull()
    })
  })

  it("still blocks a non-head member from touching submitted expenses while reviewing", async () => {
    await withRollback(async tx => {
      const { prop, member } = await seed(tx)
      const memberCaller = createCaller(ctxFor(tx, authUser(member)))
      const created = await memberCaller.expense.create({
        property_id: prop.id,
        amount: 500,
        date: aDate,
        status: "submitted",
      })
      await seedReviewingSettlement(tx, prop.id)
      await expect(
        memberCaller.expense.update({
          id: created.id,
          property_id: prop.id,
          amount: 600,
          date: aDate,
          status: "submitted",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        memberCaller.expense.delete({ id: created.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})
