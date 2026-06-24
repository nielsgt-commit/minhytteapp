import { afterAll, describe, expect, it } from "vitest"
import { db, pool } from "../db/client.ts"
import { propertyTable } from "../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../db/schema/users.schema.ts"
import type { AuthUser, Context } from "./context.ts"
import {
  assertPropertyHead,
  assertPropertyHeadOrAdmin,
  createCallerFactory,
  isPropertyHead,
} from "./init.ts"
import { appRouter } from "./routers/_app.ts"

// Regression tests for the property-scoped authorization model (the app's only
// "row-level security" — there is no Postgres RLS). Each test seeds two fully
// isolated properties inside a transaction that is always rolled back, then
// drives real procedures through a tRPC caller with a chosen ctx.user.

const createCaller = createCallerFactory(appRouter)

function authUser(
  row: { id: number; name: string; email: string },
  overrides: Partial<AuthUser> = {},
): AuthUser {
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
    ...overrides,
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function ctxFor(tx: Tx, user: AuthUser): Context {
  return { db: tx, session: null, user } as unknown as Context
}

async function seed(tx: Tx) {
  const [propA] = await tx
    .insert(propertyTable)
    .values({ name: "Prop A", address: "addr A" })
    .returning()
  const [propB] = await tx
    .insert(propertyTable)
    .values({ name: "Prop B", address: "addr B" })
    .returning()
  const [userA] = await tx
    .insert(usersTable)
    .values({ name: "User A", email: "authz-test-a@example.test" })
    .returning()
  const [userB] = await tx
    .insert(usersTable)
    .values({ name: "User B", email: "authz-test-b@example.test" })
    .returning()
  const [groupA] = await tx
    .insert(userGroupsTable)
    .values({ name: "Fam A", is_family: true, property_id: propA.id })
    .returning()
  const [groupB] = await tx
    .insert(userGroupsTable)
    .values({ name: "Fam B", is_family: true, property_id: propB.id })
    .returning()
  await tx
    .insert(userGroupMembersTable)
    .values({ user_group_id: groupA.id, user_id: userA.id, is_head: true })
  await tx
    .insert(userGroupMembersTable)
    .values({ user_group_id: groupB.id, user_id: userB.id, is_head: true })
  return { propA, propB, userA, userB, groupA, groupB }
}

class Rollback extends Error {}

// Always rolls back so the dev DB is untouched. Assertion failures (non-
// Rollback) still propagate and fail the test.
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

describe("property-scoped read endpoints reject non-members (IDOR)", () => {
  const readEndpoints: [
    string,
    (
      c: ReturnType<typeof createCaller>,
      propertyId: number,
    ) => Promise<unknown>,
  ][] = [
    [
      "expense.listForProperty",
      (c, id) => c.expense.listForProperty({ property_id: id }),
    ],
    [
      "settlement.listForProperty",
      (c, id) => c.settlement.listForProperty({ property_id: id }),
    ],
    [
      "propertySplitPolicy.listForProperty",
      (c, id) => c.propertySplitPolicy.listForProperty({ property_id: id }),
    ],
    [
      "booking.listForProperty",
      (c, id) => c.booking.listForProperty({ property_id: id }),
    ],
    ["event.list", (c, id) => c.event.list({ property_id: id })],
    [
      "maintenance.listForProperty",
      (c, id) => c.maintenance.listForProperty({ property_id: id }),
    ],
    [
      "inspection.listForProperty",
      (c, id) => c.inspection.listForProperty({ property_id: id }),
    ],
    [
      "room.listForProperty",
      (c, id) => c.room.listForProperty({ property_id: id }),
    ],
    [
      "structure.listForProperty",
      (c, id) => c.structure.listForProperty({ property_id: id }),
    ],
  ]

  it.each(readEndpoints)(
    "%s: non-member FORBIDDEN, member allowed",
    async (_name, call) => {
      await withRollback(async tx => {
        const { propA, userA, userB } = await seed(tx)
        // userB belongs only to property B → must be refused property A's data
        await expect(
          call(createCaller(ctxFor(tx, authUser(userB))), propA.id),
        ).rejects.toMatchObject({ code: "FORBIDDEN" })
        // userA belongs to property A → allowed
        await expect(
          call(createCaller(ctxFor(tx, authUser(userA))), propA.id),
        ).resolves.toBeDefined()
      })
    },
  )
})

// The platform-admin flag grants operator powers but must NOT, on its own,
// make someone a "head" of a property — head-level settlement/expense
// participation comes from real family-group membership. Operator surfaces
// (invites, priority weeks) keep an explicit admin override via
// assertPropertyHeadOrAdmin.
describe("admin flag is decoupled from property-head status", () => {
  it("isPropertyHead is false for a non-member admin, true for a real head", async () => {
    await withRollback(async tx => {
      const { propA, userA, userB } = await seed(tx)
      const dbLike = tx as unknown as typeof db
      // userB is a platform admin but belongs only to property B.
      expect(
        await isPropertyHead(
          dbLike,
          authUser(userB, { is_admin: true }),
          propA.id,
        ),
      ).toBe(false)
      // userA is a real head of property A.
      expect(await isPropertyHead(dbLike, authUser(userA), propA.id)).toBe(true)
    })
  })

  it("assertPropertyHeadOrAdmin still lets a non-member admin act, while the head-only gate refuses them", async () => {
    await withRollback(async tx => {
      const { propA, userB } = await seed(tx)
      const dbLike = tx as unknown as typeof db
      const admin = authUser(userB, { is_admin: true })
      // Operator override: admins pass even without membership.
      await expect(
        assertPropertyHeadOrAdmin(dbLike, admin, propA.id),
      ).resolves.toBeUndefined()
      // Participation gate: the membership-only check refuses the same admin.
      await expect(
        assertPropertyHead(dbLike, admin, propA.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

describe("user.create privilege escalation", () => {
  it("strips is_admin when the caller is not an admin", async () => {
    await withRollback(async tx => {
      const { userB } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(userB)))
      const created = await caller.user.create({
        name: "Sneaky",
        email: "authz-test-escalation@example.test",
        is_admin: true,
      })
      expect(created.is_admin).toBe(false)
    })
  })

  it("keeps is_admin when the caller is an admin", async () => {
    await withRollback(async tx => {
      const { userA } = await seed(tx)
      const caller = createCaller(
        ctxFor(tx, authUser(userA, { is_admin: true })),
      )
      const created = await caller.user.create({
        name: "Real Admin",
        email: "authz-test-newadmin@example.test",
        is_admin: true,
      })
      expect(created.is_admin).toBe(true)
    })
  })
})

describe("userGroup by-id writes are bound to the group's property", () => {
  it("delete refuses a group that belongs to another property", async () => {
    await withRollback(async tx => {
      const { propB, userB, groupA } = await seed(tx)
      // userB is a member of property B; passing property_id B passes the
      // procedure's membership check, but groupA belongs to property A.
      const caller = createCaller(ctxFor(tx, authUser(userB)))
      await expect(
        caller.userGroup.delete({ id: groupA.id, property_id: propB.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("addMember refuses a group that belongs to another property", async () => {
    await withRollback(async tx => {
      const { propB, userB, groupA } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(userB)))
      await expect(
        caller.userGroup.addMember({
          property_id: propB.id,
          user_group_id: groupA.id,
          user_id: userB.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("delete allows a group that belongs to the caller's property", async () => {
    await withRollback(async tx => {
      const { propA, userA, groupA } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(userA)))
      await expect(
        caller.userGroup.delete({ id: groupA.id, property_id: propA.id }),
      ).resolves.toBeDefined()
    })
  })
})

// A user may belong to several properties (own multiple cabins). Listing
// property A's users/groups must NOT bleed in people or groups that only exist
// in property B, even when the caller is the shared member linking the two.
// Previously `relevantGroupIdsForProperty` transitively expanded to "every
// group the property's members belong to", which leaked the other property's
// roster across the boundary.
describe("user/group listings are isolated per property for a shared member", () => {
  // sharedUser is a member of BOTH properties; outsider exists only in B.
  async function seedShared(tx: Tx) {
    const [propA] = await tx
      .insert(propertyTable)
      .values({ name: "Prop A", address: "addr A" })
      .returning()
    const [propB] = await tx
      .insert(propertyTable)
      .values({ name: "Prop B", address: "addr B" })
      .returning()
    const [sharedUser] = await tx
      .insert(usersTable)
      .values({ name: "Shared", email: "authz-test-shared@example.test" })
      .returning()
    const [outsider] = await tx
      .insert(usersTable)
      .values({ name: "Outsider B", email: "authz-test-outsider@example.test" })
      .returning()
    const [groupA] = await tx
      .insert(userGroupsTable)
      .values({ name: "Fam A", is_family: true, property_id: propA.id })
      .returning()
    const [groupB] = await tx
      .insert(userGroupsTable)
      .values({ name: "Fam B", is_family: true, property_id: propB.id })
      .returning()
    await tx.insert(userGroupMembersTable).values([
      // shared member belongs to both properties' groups
      { user_group_id: groupA.id, user_id: sharedUser.id, is_head: true },
      { user_group_id: groupB.id, user_id: sharedUser.id, is_head: true },
      // outsider belongs only to property B
      { user_group_id: groupB.id, user_id: outsider.id },
    ])
    return { propA, propB, sharedUser, outsider, groupA, groupB }
  }

  it("user.listForProperty(A) excludes a user who only belongs to B", async () => {
    await withRollback(async tx => {
      const { propA, sharedUser, outsider } = await seedShared(tx)
      const caller = createCaller(ctxFor(tx, authUser(sharedUser)))
      const users = await caller.user.listForProperty({ property_id: propA.id })
      const ids = users.map(u => u.id)
      expect(ids).toContain(sharedUser.id)
      expect(ids).not.toContain(outsider.id)
    })
  })

  it("userGroup.listWithMembersForProperty(A) excludes property B's group", async () => {
    await withRollback(async tx => {
      const { propA, sharedUser, outsider, groupA, groupB } =
        await seedShared(tx)
      const caller = createCaller(ctxFor(tx, authUser(sharedUser)))
      const groups = await caller.userGroup.listWithMembersForProperty({
        property_id: propA.id,
      })
      const groupIds = groups.map(g => g.id)
      expect(groupIds).toContain(groupA.id)
      expect(groupIds).not.toContain(groupB.id)
      // and the outsider must not surface through any returned group's members
      const memberIds = groups.flatMap(g => g.members.map(m => m.user_id))
      expect(memberIds).not.toContain(outsider.id)
    })
  })
})
