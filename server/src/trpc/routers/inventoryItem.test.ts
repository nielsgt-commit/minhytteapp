// Authz + location-ref seams for the inventory item router: membership gates
// on every procedure, cross-property structure/room refs are refused, a room
// derives its structure server-side, and category_id must be an active
// category of the caller's property.

import { afterAll, describe, expect, it } from "vitest"
import { pool } from "../../db/client.ts"
import { inventoryCategoriesTable } from "../../db/schema/inventory.schema.ts"
import {
  propertyTable,
  roomTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
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

// One property with a member and an outsider; a structure with a room, plus a
// second structure, and a foreign property whose structure/room/category must
// be unreachable across the boundary. Categories are inserted directly: the
// item router only consumes them (the category router manages them).
async function seed(tx: Tx) {
  const [prop, otherProp] = await tx
    .insert(propertyTable)
    .values([
      { name: "Inv Test Prop", address: "addr" },
      { name: "Inv Test Other Prop", address: "addr2" },
    ])
    .returning()
  const [member, outsider] = await tx
    .insert(usersTable)
    .values([
      { name: "Member", email: "inv-test-member@example.test" },
      { name: "Outsider", email: "inv-test-outsider@example.test" },
    ])
    .returning()
  const [group] = await tx
    .insert(userGroupsTable)
    .values({ name: "Inv Fam", is_family: true, property_id: prop.id })
    .returning()
  await tx
    .insert(userGroupMembersTable)
    .values([{ user_group_id: group.id, user_id: member.id, is_head: false }])
  const [cabin, annex, foreignCabin] = await tx
    .insert(structuresTable)
    .values([
      { name: "Cabin", property_id: prop.id },
      { name: "Annex", property_id: prop.id },
      { name: "Foreign Cabin", property_id: otherProp.id },
    ])
    .returning()
  const [kitchen, foreignRoom] = await tx
    .insert(roomTable)
    .values([
      { name: "Kitchen", structure_id: cabin.id },
      { name: "Foreign Room", structure_id: foreignCabin.id },
    ])
    .returning()
  const [dryGoods, cannedGoods, tools, archived, foreignCat] = await tx
    .insert(inventoryCategoriesTable)
    .values([
      { property_id: prop.id, name: "Dry goods", kind: "food" },
      { property_id: prop.id, name: "Canned goods", kind: "food" },
      { property_id: prop.id, name: "Tools", kind: "general" },
      {
        property_id: prop.id,
        name: "Retired",
        kind: "food",
        archived_at: new Date(),
      },
      { property_id: otherProp.id, name: "Dry goods", kind: "food" },
    ])
    .returning()
  return {
    prop,
    otherProp,
    member,
    outsider,
    cabin,
    annex,
    foreignCabin,
    kitchen,
    foreignRoom,
    dryGoods,
    cannedGoods,
    tools,
    archived,
    foreignCat,
  }
}

afterAll(async () => {
  await pool.end()
})

describe("membership gates", () => {
  it("refuses a non-member on list/create/update and delete", async () => {
    await withRollback(async tx => {
      const { prop, member, outsider, dryGoods } = await seed(tx)
      const memberCaller = createCaller(ctxFor(tx, authUser(member)))
      const item = await memberCaller.inventoryItem.create({
        property_id: prop.id,
        name: "Flour",
        category_id: dryGoods.id,
      })

      const outsiderCaller = createCaller(ctxFor(tx, authUser(outsider)))
      await expect(
        outsiderCaller.inventoryItem.listForProperty({ property_id: prop.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        outsiderCaller.inventoryItem.create({
          property_id: prop.id,
          name: "Sneaky",
          category_id: dryGoods.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        outsiderCaller.inventoryItem.update({
          property_id: prop.id,
          id: item.id,
          name: "Sneaky",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        outsiderCaller.inventoryItem.delete({ id: item.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("refuses reassigning an item to another property via update", async () => {
    await withRollback(async tx => {
      const { prop, otherProp, member, dryGoods } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const item = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Flour",
        category_id: dryGoods.id,
      })

      await expect(
        caller.inventoryItem.update({
          property_id: otherProp.id,
          id: item.id,
          name: "Moved",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

describe("location refs", () => {
  it("refuses a structure or room from another property", async () => {
    await withRollback(async tx => {
      const { prop, member, foreignCabin, foreignRoom, dryGoods } =
        await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Sheets",
          category_id: dryGoods.id,
          structure_id: foreignCabin.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Sheets",
          category_id: dryGoods.id,
          room_id: foreignRoom.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("derives the structure from the room and rejects a mismatching pair", async () => {
    await withRollback(async tx => {
      const { prop, member, cabin, annex, kitchen, dryGoods } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      const derived = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Coffee",
        category_id: dryGoods.id,
        room_id: kitchen.id,
      })
      expect(derived.structure_id).toBe(cabin.id)
      expect(derived.room_id).toBe(kitchen.id)

      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Coffee",
          category_id: dryGoods.id,
          structure_id: annex.id,
          room_id: kitchen.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })

  it("keeps location refs on a rename and clears fields set to null", async () => {
    await withRollback(async tx => {
      const { prop, member, cabin, kitchen, dryGoods } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const item = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Coffee",
        category_id: dryGoods.id,
        quantity: 2,
        location: "Top shelf",
        room_id: kitchen.id,
      })

      const renamed = await caller.inventoryItem.update({
        property_id: prop.id,
        id: item.id,
        name: "Dark roast",
      })
      expect(renamed).toMatchObject({
        name: "Dark roast",
        quantity: 2,
        location: "Top shelf",
        structure_id: cabin.id,
        room_id: kitchen.id,
      })

      const cleared = await caller.inventoryItem.update({
        property_id: prop.id,
        id: item.id,
        quantity: null,
        location: null,
        structure_id: null,
        room_id: null,
      })
      expect(cleared).toMatchObject({
        name: "Dark roast",
        quantity: null,
        location: null,
        structure_id: null,
        room_id: null,
      })
    })
  })
})

describe("category validation", () => {
  it("refuses a foreign, unknown, or archived category on create", async () => {
    await withRollback(async tx => {
      const { prop, member, foreignCat, archived } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Sneaky",
          category_id: foreignCat.id,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Nowhere",
          category_id: 999_999,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Stale",
          category_id: archived.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })

  it("puts the category id, name, and kind on the wire", async () => {
    await withRollback(async tx => {
      const { prop, member, tools } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      const created = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Hammer",
        category_id: tools.id,
      })
      expect(created).toMatchObject({
        category_id: tools.id,
        category: "Tools",
        kind: "general",
      })

      const listed = await caller.inventoryItem.listForProperty({
        property_id: prop.id,
      })
      expect(listed).toHaveLength(1)
      expect(listed[0]).toMatchObject({
        category_id: tools.id,
        category: "Tools",
        kind: "general",
      })
    })
  })

  it("moves an item to another category via update and reports it on list", async () => {
    await withRollback(async tx => {
      const { prop, member, dryGoods, cannedGoods, archived, foreignCat } =
        await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const item = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Tomatoes",
        category_id: dryGoods.id,
      })

      const moved = await caller.inventoryItem.update({
        property_id: prop.id,
        id: item.id,
        category_id: cannedGoods.id,
      })
      expect(moved).toMatchObject({
        category_id: cannedGoods.id,
        category: "Canned goods",
        kind: "food",
      })

      // A category-less update still reports the current category.
      const renamed = await caller.inventoryItem.update({
        property_id: prop.id,
        id: item.id,
        name: "Crushed tomatoes",
      })
      expect(renamed).toMatchObject({
        category_id: cannedGoods.id,
        category: "Canned goods",
      })

      // Moving to an archived or foreign category is refused.
      await expect(
        caller.inventoryItem.update({
          property_id: prop.id,
          id: item.id,
          category_id: archived.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        caller.inventoryItem.update({
          property_id: prop.id,
          id: item.id,
          category_id: foreignCat.id,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })

      const listed = await caller.inventoryItem.listForProperty({
        property_id: prop.id,
      })
      expect(listed.map(i => i.category)).toEqual(["Canned goods"])
    })
  })
})
