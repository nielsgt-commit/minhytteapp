// Authz + lifecycle seams for the inventory category router: any member can
// list, only a property head can write (the categoryWriteProcedure default —
// flip these expectations if that const changes), names are unique per
// property while active, and a category with items can't be archived.

import { afterAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { pool } from "../../db/client.ts"
import {
  inventoryCategoriesTable,
  inventoryItemsTable,
} from "../../db/schema/inventory.schema.ts"
import { propertyTable } from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { createCallerFactory } from "../init.ts"
import type { Tx } from "../test-utils.ts"
import { authUser, ctxFor, withRollback } from "../test-utils.ts"
import { appRouter } from "./_app.ts"

const createCaller = createCallerFactory(appRouter)

// One property with a head, a plain member, and an outsider; categories of
// both kinds plus a foreign property's category across the boundary.
async function seed(tx: Tx) {
  const [prop, otherProp] = await tx
    .insert(propertyTable)
    .values([
      { name: "InvCat Test Prop", address: "addr" },
      { name: "InvCat Test Other Prop", address: "addr2" },
    ])
    .returning()
  const [head, member, outsider] = await tx
    .insert(usersTable)
    .values([
      { name: "Head", email: "invcat-test-head@example.test" },
      { name: "Member", email: "invcat-test-member@example.test" },
      { name: "Outsider", email: "invcat-test-outsider@example.test" },
    ])
    .returning()
  const [group] = await tx
    .insert(userGroupsTable)
    .values({ name: "InvCat Fam", is_family: true, property_id: prop.id })
    .returning()
  await tx.insert(userGroupMembersTable).values([
    { user_group_id: group.id, user_id: head.id, is_head: true },
    { user_group_id: group.id, user_id: member.id, is_head: false },
  ])
  const [dryGoods, tools, foreignCat] = await tx
    .insert(inventoryCategoriesTable)
    .values([
      { property_id: prop.id, name: "Dry goods", kind: "food" },
      { property_id: prop.id, name: "Tools", kind: "general" },
      { property_id: otherProp.id, name: "Foreign", kind: "food" },
    ])
    .returning()
  return {
    prop,
    otherProp,
    head,
    member,
    outsider,
    dryGoods,
    tools,
    foreignCat,
  }
}

afterAll(async () => {
  await pool.end()
})

describe("list", () => {
  it("lists a member's active categories, optionally filtered by kind", async () => {
    await withRollback(async tx => {
      const { prop, member, outsider, dryGoods, tools } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      const all = await caller.inventoryCategory.list({ property_id: prop.id })
      expect(all.map(c => c.name).sort()).toEqual(["Dry goods", "Tools"])

      const food = await caller.inventoryCategory.list({
        property_id: prop.id,
        kind: "food",
      })
      expect(food).toEqual([
        { id: dryGoods.id, name: "Dry goods", kind: "food" },
      ])
      const general = await caller.inventoryCategory.list({
        property_id: prop.id,
        kind: "general",
      })
      expect(general).toEqual([
        { id: tools.id, name: "Tools", kind: "general" },
      ])

      const outsiderCaller = createCaller(ctxFor(tx, authUser(outsider)))
      await expect(
        outsiderCaller.inventoryCategory.list({ property_id: prop.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

describe("write auth (head-only default)", () => {
  it("refuses a plain member on create/rename/archive", async () => {
    await withRollback(async tx => {
      const { prop, member, dryGoods } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      await expect(
        caller.inventoryCategory.create({
          property_id: prop.id,
          name: "Snacks",
          kind: "food",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        caller.inventoryCategory.rename({
          property_id: prop.id,
          id: dryGoods.id,
          name: "Pantry",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        caller.inventoryCategory.archive({
          property_id: prop.id,
          id: dryGoods.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

describe("create", () => {
  it("creates for a head and refuses an active duplicate name (any kind)", async () => {
    await withRollback(async tx => {
      const { prop, head } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(head)))

      const created = await caller.inventoryCategory.create({
        property_id: prop.id,
        name: "Snacks",
        kind: "food",
      })
      expect(created).toMatchObject({ name: "Snacks", kind: "food" })
      const listed = await caller.inventoryCategory.list({
        property_id: prop.id,
        kind: "food",
      })
      expect(listed.map(c => c.name)).toContain("Snacks")

      await expect(
        caller.inventoryCategory.create({
          property_id: prop.id,
          name: "Snacks",
          kind: "food",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      // The unique index is name-only, so the same name in the OTHER kind is
      // also refused.
      await expect(
        caller.inventoryCategory.create({
          property_id: prop.id,
          name: "Snacks",
          kind: "general",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })
})

describe("rename", () => {
  it("renames, refuses duplicates and archived rows, and hides foreign ids", async () => {
    await withRollback(async tx => {
      const { prop, head, dryGoods, tools, foreignCat } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(head)))

      const renamed = await caller.inventoryCategory.rename({
        property_id: prop.id,
        id: dryGoods.id,
        name: "Pantry staples",
      })
      expect(renamed).toMatchObject({ name: "Pantry staples" })
      // Renaming to itself (no-op) is allowed.
      await caller.inventoryCategory.rename({
        property_id: prop.id,
        id: dryGoods.id,
        name: "Pantry staples",
      })

      await expect(
        caller.inventoryCategory.rename({
          property_id: prop.id,
          id: dryGoods.id,
          name: "Tools",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        caller.inventoryCategory.rename({
          property_id: prop.id,
          id: foreignCat.id,
          name: "Hijack",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })

      await caller.inventoryCategory.archive({
        property_id: prop.id,
        id: tools.id,
      })
      await expect(
        caller.inventoryCategory.rename({
          property_id: prop.id,
          id: tools.id,
          name: "Hardware",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })
})

describe("archive", () => {
  it("archives an empty category, frees its name, and hides foreign ids", async () => {
    await withRollback(async tx => {
      const { prop, head, dryGoods, foreignCat } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(head)))

      await expect(
        caller.inventoryCategory.archive({
          property_id: prop.id,
          id: foreignCat.id,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })

      const archived = await caller.inventoryCategory.archive({
        property_id: prop.id,
        id: dryGoods.id,
      })
      expect(archived.archived_at).not.toBeNull()
      const listed = await caller.inventoryCategory.list({
        property_id: prop.id,
      })
      expect(listed.map(c => c.name)).not.toContain("Dry goods")

      // The partial unique index only covers active rows: the name is
      // immediately reusable.
      const recreated = await caller.inventoryCategory.create({
        property_id: prop.id,
        name: "Dry goods",
        kind: "food",
      })
      expect(recreated.name).toBe("Dry goods")
    })
  })

  it("refuses to archive a category that still has items", async () => {
    await withRollback(async tx => {
      const { prop, head, dryGoods } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      await tx.insert(inventoryItemsTable).values({
        property_id: prop.id,
        category_id: dryGoods.id,
        name: "Flour",
      })

      await expect(
        caller.inventoryCategory.archive({
          property_id: prop.id,
          id: dryGoods.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      // Still listed and still active in the DB.
      const listed = await caller.inventoryCategory.list({
        property_id: prop.id,
      })
      expect(listed.map(c => c.name)).toContain("Dry goods")
      const [row] = await tx
        .select()
        .from(inventoryCategoriesTable)
        .where(eq(inventoryCategoriesTable.id, dryGoods.id))
      expect(row.archived_at).toBeNull()
    })
  })
})
