// Authz + location-ref seams for the inventory router: membership gates on
// every procedure, cross-property structure/room refs are refused, a room
// derives its structure server-side, and the Food category is lazily ensured
// exactly once per property.

import { afterAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { pool } from "../../db/client.ts"
import {
  inventoryCategoriesTable,
  inventoryItemsTable,
} from "../../db/schema/inventory.schema.ts"
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
// second structure, and a foreign property whose structure/room must be
// unreachable across the boundary.
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
  }
}

async function categoryRows(tx: Tx, propertyId: number) {
  return tx
    .select()
    .from(inventoryCategoriesTable)
    .where(eq(inventoryCategoriesTable.property_id, propertyId))
}

afterAll(async () => {
  await pool.end()
})

describe("membership gates", () => {
  it("refuses a non-member on list/create/update and delete", async () => {
    await withRollback(async tx => {
      const { prop, member, outsider } = await seed(tx)
      const memberCaller = createCaller(ctxFor(tx, authUser(member)))
      const item = await memberCaller.inventoryItem.create({
        property_id: prop.id,
        name: "Flour",
      })

      const outsiderCaller = createCaller(ctxFor(tx, authUser(outsider)))
      await expect(
        outsiderCaller.inventoryItem.listForProperty({ property_id: prop.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        outsiderCaller.inventoryItem.create({
          property_id: prop.id,
          name: "Sneaky",
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
      const { prop, otherProp, member } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const item = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Flour",
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
      const { prop, member, foreignCabin, foreignRoom } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Sheets",
          structure_id: foreignCabin.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Sheets",
          room_id: foreignRoom.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  it("derives the structure from the room and rejects a mismatching pair", async () => {
    await withRollback(async tx => {
      const { prop, member, cabin, annex, kitchen } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))

      const derived = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Coffee",
        room_id: kitchen.id,
      })
      expect(derived.structure_id).toBe(cabin.id)
      expect(derived.room_id).toBe(kitchen.id)

      await expect(
        caller.inventoryItem.create({
          property_id: prop.id,
          name: "Coffee",
          structure_id: annex.id,
          room_id: kitchen.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })

  it("keeps location refs on a rename and clears fields set to null", async () => {
    await withRollback(async tx => {
      const { prop, member, cabin, kitchen } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const item = await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Coffee",
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

describe("food category ensure", () => {
  it("creates the Food category once and reuses it", async () => {
    await withRollback(async tx => {
      const { prop, member } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      // Freshly seeded property inside the tx: no category yet (the 0093 seed
      // only covers properties that existed when the migration ran).
      expect(await categoryRows(tx, prop.id)).toHaveLength(0)

      await caller.inventoryItem.create({ property_id: prop.id, name: "Salt" })
      const afterFirst = await categoryRows(tx, prop.id)
      expect(afterFirst).toHaveLength(1)
      expect(afterFirst[0].name).toBe("Food")

      await caller.inventoryItem.create({
        property_id: prop.id,
        name: "Pepper",
      })
      expect(await categoryRows(tx, prop.id)).toHaveLength(1)

      const items = await tx
        .select()
        .from(inventoryItemsTable)
        .where(eq(inventoryItemsTable.property_id, prop.id))
      expect(items.map(i => i.category_id)).toEqual([
        afterFirst[0].id,
        afterFirst[0].id,
      ])
    })
  })
})
