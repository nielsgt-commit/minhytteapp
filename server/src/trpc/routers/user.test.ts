// Characterization tests for the user router's write surface: child
// create/link/unlink invariants (parent-only edits, a child cannot be a
// parent, at most two parents), updateMyHeadForProperty scoping, the
// listLinkableParents visibility filter, and the role-flag escalation guard
// on create. Read-IDOR sweeps live in authorization.test.ts.

import { afterAll, describe, expect, it } from "vitest"
import { and, eq } from "drizzle-orm"
import { pool } from "../../db/client.ts"
import { propertyTable } from "../../db/schema/property.schema.ts"
import {
  childParentsTable,
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { createCallerFactory } from "../init.ts"
import type { Tx } from "../test-utils.ts"
import { authUser, ctxFor, withRollback } from "../test-utils.ts"
import { appRouter } from "./_app.ts"

const createCaller = createCallerFactory(appRouter)

// Property 1 has two family groups (Alice+Bob in A, Carol in B); Alice is
// also a member of property 2's family group alongside Dave. Eve lives on an
// unrelated third property, and the outsider has no membership anywhere.
async function seed(tx: Tx) {
  const [prop1, prop2, prop3] = await tx
    .insert(propertyTable)
    .values([
      { name: "User Test Prop 1", address: "addr1" },
      { name: "User Test Prop 2", address: "addr2" },
      { name: "User Test Prop 3", address: "addr3" },
    ])
    .returning()
  const [alice, bob, carol, dave, eve, outsider] = await tx
    .insert(usersTable)
    .values([
      { name: "Alice", email: "user-test-alice@example.test" },
      { name: "Bob", email: "user-test-bob@example.test" },
      { name: "Carol", email: "user-test-carol@example.test" },
      { name: "Dave", email: "user-test-dave@example.test" },
      { name: "Eve", email: "user-test-eve@example.test" },
      { name: "Outsider", email: "user-test-outsider@example.test" },
    ])
    .returning()
  const [groupA, groupB, groupD, groupE] = await tx
    .insert(userGroupsTable)
    .values([
      { name: "UT Fam A", is_family: true, property_id: prop1.id },
      { name: "UT Fam B", is_family: true, property_id: prop1.id },
      { name: "UT Fam D", is_family: true, property_id: prop2.id },
      { name: "UT Fam E", is_family: true, property_id: prop3.id },
    ])
    .returning()
  await tx.insert(userGroupMembersTable).values([
    { user_group_id: groupA.id, user_id: alice.id, is_head: false },
    { user_group_id: groupA.id, user_id: bob.id, is_head: false },
    { user_group_id: groupB.id, user_id: carol.id, is_head: false },
    { user_group_id: groupD.id, user_id: alice.id, is_head: false },
    { user_group_id: groupD.id, user_id: dave.id, is_head: false },
    { user_group_id: groupE.id, user_id: eve.id, is_head: false },
  ])
  return {
    prop1,
    prop2,
    alice,
    bob,
    carol,
    dave,
    eve,
    outsider,
    groupA,
    groupB,
    groupD,
  }
}

afterAll(async () => {
  await pool.end()
})

describe("child lifecycle", () => {
  it("createChild creates a child user linked to its creator", async () => {
    await withRollback(async tx => {
      const { alice } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(alice)))
      const child = await caller.user.createChild({ name: "Kid" })
      expect(child.is_child).toBe(true)
      expect(child.parent_user_id).toBe(alice.id)
      // Synthetic email so the child can never receive a magic link.
      expect(child.email).toMatch(/^child-.*@example\.local$/)

      const links = await tx
        .select()
        .from(childParentsTable)
        .where(eq(childParentsTable.child_user_id, child.id))
      expect(links).toEqual([
        { child_user_id: child.id, parent_user_id: alice.id },
      ])

      const listed = await caller.user.listMyChildren()
      expect(listed).toEqual([
        {
          id: child.id,
          name: "Kid",
          parents: [{ id: alice.id, name: "Alice", isCreator: true }],
        },
      ])
    })
  })

  it("updateChild and removeChild are parent-only", async () => {
    await withRollback(async tx => {
      const { alice, bob } = await seed(tx)
      const callerAlice = createCaller(ctxFor(tx, authUser(alice)))
      const callerBob = createCaller(ctxFor(tx, authUser(bob)))
      const child = await callerAlice.user.createChild({ name: "Kid" })

      // Bob shares a group with Alice but is not a parent of the child.
      await expect(
        callerBob.user.updateChild({ id: child.id, name: "Hijack" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      await expect(
        callerBob.user.removeChild({ id: child.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })

      const renamed = await callerAlice.user.updateChild({
        id: child.id,
        name: "Kiddo",
      })
      expect(renamed.name).toBe("Kiddo")

      await callerAlice.user.removeChild({ id: child.id })
      const rows = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, child.id))
      expect(rows).toHaveLength(0)
    })
  })

  it("updateChild never touches a non-child user, even via a stray parent link", async () => {
    await withRollback(async tx => {
      const { alice, bob } = await seed(tx)
      // Synthetic link: callerIsParent passes, but the update's is_child
      // filter must still refuse to rename a real user.
      await tx.insert(childParentsTable).values({
        child_user_id: bob.id,
        parent_user_id: alice.id,
      })
      const caller = createCaller(ctxFor(tx, authUser(alice)))
      await expect(
        caller.user.updateChild({ id: bob.id, name: "Not A Child" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })
})

describe("addParent / removeParent", () => {
  it("links a second parent and rejects self, children, duplicates and a third parent", async () => {
    await withRollback(async tx => {
      const { alice, bob, carol } = await seed(tx)
      const callerAlice = createCaller(ctxFor(tx, authUser(alice)))
      const callerBob = createCaller(ctxFor(tx, authUser(bob)))
      const child = await callerAlice.user.createChild({ name: "Kid" })

      // Only an existing parent may manage the child's parent links.
      await expect(
        callerBob.user.addParent({
          childId: child.id,
          parentUserId: carol.id,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })

      await expect(
        callerAlice.user.addParent({
          childId: child.id,
          parentUserId: alice.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })

      const otherChild = await callerAlice.user.createChild({ name: "Kid 2" })
      await expect(
        callerAlice.user.addParent({
          childId: child.id,
          parentUserId: otherChild.id,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "a child cannot be a parent",
      })

      await callerAlice.user.addParent({
        childId: child.id,
        parentUserId: bob.id,
      })
      // Bob is now a parent and may edit the child himself.
      const renamed = await callerBob.user.updateChild({
        id: child.id,
        name: "Kiddo",
      })
      expect(renamed.name).toBe("Kiddo")

      await expect(
        callerAlice.user.addParent({
          childId: child.id,
          parentUserId: bob.id,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" })
      await expect(
        callerAlice.user.addParent({
          childId: child.id,
          parentUserId: carol.id,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "a child can have at most two parents",
      })
    })
  })

  it("removeParent unlinks a co-parent but never the primary parent", async () => {
    await withRollback(async tx => {
      const { alice, bob } = await seed(tx)
      const callerAlice = createCaller(ctxFor(tx, authUser(alice)))
      const callerBob = createCaller(ctxFor(tx, authUser(bob)))
      const child = await callerAlice.user.createChild({ name: "Kid" })
      await callerAlice.user.addParent({
        childId: child.id,
        parentUserId: bob.id,
      })

      await expect(
        callerAlice.user.removeParent({
          childId: child.id,
          parentUserId: alice.id,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "cannot remove the primary parent",
      })

      // Any parent (here: the co-parent himself) may remove the co-parent.
      const removed = await callerBob.user.removeParent({
        childId: child.id,
        parentUserId: bob.id,
      })
      expect(removed).toMatchObject({
        child_user_id: child.id,
        parent_user_id: bob.id,
      })

      // The link is gone, so removing it again finds nothing.
      await expect(
        callerAlice.user.removeParent({
          childId: child.id,
          parentUserId: bob.id,
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "parent link not found",
      })
    })
  })
})

describe("updateMyHeadForProperty", () => {
  it("only flips the caller's membership on that property", async () => {
    await withRollback(async tx => {
      const { prop1, alice, bob, groupA, groupD } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(alice)))
      const updated = await caller.user.updateMyHeadForProperty({
        property_id: prop1.id,
        is_head: true,
      })
      expect(updated).toMatchObject({
        user_id: alice.id,
        user_group_id: groupA.id,
        is_head: true,
      })

      const memberRow = async (groupId: number, userId: number) =>
        (
          await tx
            .select({ is_head: userGroupMembersTable.is_head })
            .from(userGroupMembersTable)
            .where(
              and(
                eq(userGroupMembersTable.user_group_id, groupId),
                eq(userGroupMembersTable.user_id, userId),
              ),
            )
        )[0]
      expect((await memberRow(groupA.id, alice.id)).is_head).toBe(true)
      // Same group, other member: untouched.
      expect((await memberRow(groupA.id, bob.id)).is_head).toBe(false)
      // Same caller, other property's group: untouched.
      expect((await memberRow(groupD.id, alice.id)).is_head).toBe(false)
    })
  })

  it("throws NOT_FOUND without a family membership on the property", async () => {
    await withRollback(async tx => {
      const { prop1, outsider } = await seed(tx)
      await expect(
        createCaller(
          ctxFor(tx, authUser(outsider)),
        ).user.updateMyHeadForProperty({
          property_id: prop1.id,
          is_head: true,
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "no main-group membership for this property",
      })
    })
  })
})

describe("listLinkableParents", () => {
  it("returns non-child members of the caller's visible groups, excluding the caller", async () => {
    await withRollback(async tx => {
      const { alice, bob, carol, dave, groupA } = await seed(tx)
      // A child inside a visible group must still be filtered out.
      const [childMember] = await tx
        .insert(usersTable)
        .values({
          name: "Child Member",
          email: "user-test-child-member@example.test",
          is_child: true,
        })
        .returning()
      await tx.insert(userGroupMembersTable).values({
        user_group_id: groupA.id,
        user_id: childMember.id,
      })

      const result = await createCaller(
        ctxFor(tx, authUser(alice)),
      ).user.listLinkableParents()
      // Visible via prop 1 (both groups) and prop 2; Eve's property and the
      // outsider are not. Sorted by name.
      expect(result).toEqual([
        { id: bob.id, name: "Bob" },
        { id: carol.id, name: "Carol" },
        { id: dave.id, name: "Dave" },
      ])
    })
  })

  it("returns nothing for a user with no group memberships", async () => {
    await withRollback(async tx => {
      const { outsider } = await seed(tx)
      const result = await createCaller(
        ctxFor(tx, authUser(outsider)),
      ).user.listLinkableParents()
      expect(result).toEqual([])
    })
  })
})

describe("create role guard", () => {
  it("ignores role flags from non-admins and normalizes the email", async () => {
    await withRollback(async tx => {
      const { alice } = await seed(tx)
      const created = await createCaller(
        ctxFor(tx, authUser(alice)),
      ).user.create({
        name: "Stub",
        email: "User-Test-Stub@Example.Test",
        is_admin: true,
        is_child: true,
      })
      expect(created.is_admin).toBe(false)
      expect(created.is_child).toBe(false)
      expect(created.email).toBe("user-test-stub@example.test")
    })
  })
})
