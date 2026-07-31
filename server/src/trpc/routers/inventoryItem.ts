import { asc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { db as dbClient } from "../../db/client.ts"
import {
  inventoryCategoriesTable,
  inventoryItemsTable,
} from "../../db/schema/inventory.schema.ts"
import { roomTable } from "../../db/schema/property.schema.ts"
import { wireMap } from "../util/wire.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import {
  resolvePropertyIdFromInventoryItem,
  resolvePropertyIdFromRoom,
  resolvePropertyIdFromStructure,
} from "../util/propertyAccess.ts"

type Db = typeof dbClient

// Wire mapping: created_at/updated_at (timestamp) → Temporal.Instant.
const toWireInventoryItem = wireMap({
  created_at: "instant",
  updated_at: "instantOrNull",
})

// An item's category must be an active category of the caller's property.
// NOT_FOUND for missing/foreign ids (no existence leak, like the location
// refs); BAD_REQUEST for archived ones. Returns what the wire needs.
async function resolveActiveCategory(
  db: Db,
  propertyId: number,
  categoryId: number,
): Promise<{ name: string; kind: string }> {
  const category = (
    await db
      .select({
        property_id: inventoryCategoriesTable.property_id,
        name: inventoryCategoriesTable.name,
        kind: inventoryCategoriesTable.kind,
        archived_at: inventoryCategoriesTable.archived_at,
      })
      .from(inventoryCategoriesTable)
      .where(eq(inventoryCategoriesTable.id, categoryId))
      .limit(1)
  ).at(0)
  if (category?.property_id !== propertyId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "category not found" })
  }
  if (category.archived_at != null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "category is archived",
    })
  }
  return { name: category.name, kind: category.kind }
}

// Server-authoritative location refs: a room implies its structure, so the
// structure is derived from the room and an explicitly mismatching structure
// is rejected. Both refs must belong to the caller's property.
async function resolveLocationRefs(
  db: Db,
  propertyId: number,
  input: { structure_id?: number | null; room_id?: number | null },
): Promise<{ structure_id: number | null; room_id: number | null }> {
  if (input.room_id != null) {
    if ((await resolvePropertyIdFromRoom(db, input.room_id)) !== propertyId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "room does not belong to this property",
      })
    }
    const [room] = await db
      .select({ structure_id: roomTable.structure_id })
      .from(roomTable)
      .where(eq(roomTable.id, input.room_id))
      .limit(1)
    if (
      input.structure_id != null &&
      input.structure_id !== room.structure_id
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "room does not belong to the given building",
      })
    }
    return { structure_id: room.structure_id, room_id: input.room_id }
  }
  if (input.structure_id != null) {
    const structureProperty = await resolvePropertyIdFromStructure(
      db,
      input.structure_id,
    )
    if (structureProperty !== propertyId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "building does not belong to this property",
      })
    }
  }
  return { structure_id: input.structure_id ?? null, room_id: null }
}

// An empty (whitespace-trimmed) location reads as "no location".
function emptyToNull(value: string | null | undefined): string | null {
  return value != null && value !== "" ? value : null
}

// Optional fields are nullable-optional so update can distinguish "leave
// alone" (absent) from "clear" (null), matching the DB nullability.
const optionalFields = {
  quantity: z.number().int().positive().nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  structure_id: z.number().int().positive().nullable().optional(),
  room_id: z.number().int().positive().nullable().optional(),
}

// category_id is never nullable: an item always has a category (absent on
// update = leave alone).
const createInput = z.object({
  property_id: z.number().int().positive(),
  name: z.string().min(1, { error: "name is required" }).max(255),
  category_id: z.number().int().positive(),
  ...optionalFields,
})

const updateInput = z.object({
  property_id: z.number().int().positive(),
  id: z.number().int().positive(),
  name: z.string().min(1, { error: "name is required" }).max(255).optional(),
  category_id: z.number().int().positive().optional(),
  ...optionalFields,
})

// The wire carries category_id plus the joined category name and kind: the
// client groups by id but still needs the name for labels/optimistic rows.
const wireColumns = {
  id: inventoryItemsTable.id,
  property_id: inventoryItemsTable.property_id,
  category_id: inventoryItemsTable.category_id,
  name: inventoryItemsTable.name,
  quantity: inventoryItemsTable.quantity,
  location: inventoryItemsTable.location,
  structure_id: inventoryItemsTable.structure_id,
  room_id: inventoryItemsTable.room_id,
  created_at: inventoryItemsTable.created_at,
  created_by: inventoryItemsTable.created_by,
  updated_at: inventoryItemsTable.updated_at,
  updated_by: inventoryItemsTable.updated_by,
}

export const inventoryItemRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        ...wireColumns,
        category: inventoryCategoriesTable.name,
        kind: inventoryCategoriesTable.kind,
      })
      .from(inventoryItemsTable)
      .innerJoin(
        inventoryCategoriesTable,
        eq(inventoryItemsTable.category_id, inventoryCategoriesTable.id),
      )
      .where(eq(inventoryItemsTable.property_id, input.property_id))
      .orderBy(asc(inventoryItemsTable.id))
    return rows.map(toWireInventoryItem)
  }),

  create: propertyAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const refs = await resolveLocationRefs(ctx.db, input.property_id, input)
      const category = await resolveActiveCategory(
        ctx.db,
        input.property_id,
        input.category_id,
      )
      const [created] = await ctx.db
        .insert(inventoryItemsTable)
        .values({
          property_id: input.property_id,
          category_id: input.category_id,
          name: input.name,
          quantity: input.quantity ?? null,
          location: emptyToNull(input.location),
          ...refs,
          created_by: ctx.user.id,
        })
        .returning(wireColumns)
      return {
        ...toWireInventoryItem(created),
        category: category.name,
        kind: category.kind,
      }
    }),

  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolvePropertyIdFromInventoryItem(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "cannot reassign inventory item to another property",
        })
      }
      const patch: Partial<typeof inventoryItemsTable.$inferInsert> = {
        updated_at: new Date(),
        updated_by: ctx.user.id,
      }
      if (input.name !== undefined) patch.name = input.name
      let movedTo: { name: string; kind: string } | undefined
      if (input.category_id !== undefined) {
        movedTo = await resolveActiveCategory(
          ctx.db,
          input.property_id,
          input.category_id,
        )
        patch.category_id = input.category_id
      }
      if ("quantity" in input) patch.quantity = input.quantity ?? null
      if ("location" in input) patch.location = emptyToNull(input.location)
      // Location refs are set as a pair whenever either is touched (the edit
      // form always submits both), so a rename alone never wipes them.
      if ("structure_id" in input || "room_id" in input) {
        const refs = await resolveLocationRefs(ctx.db, input.property_id, input)
        patch.structure_id = refs.structure_id
        patch.room_id = refs.room_id
      }
      const [updated] = await ctx.db
        .update(inventoryItemsTable)
        .set(patch)
        .where(eq(inventoryItemsTable.id, input.id))
        .returning(wireColumns)
      const category =
        movedTo ??
        (
          await ctx.db
            .select({
              name: inventoryCategoriesTable.name,
              kind: inventoryCategoriesTable.kind,
            })
            .from(inventoryCategoriesTable)
            .where(eq(inventoryCategoriesTable.id, updated.category_id))
            .limit(1)
        )[0]
      return {
        ...toWireInventoryItem(updated),
        category: category.name,
        kind: category.kind,
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromInventoryItem(
        ctx.db,
        input.id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [deleted] = await ctx.db
        .delete(inventoryItemsTable)
        .where(eq(inventoryItemsTable.id, input.id))
        .returning(wireColumns)
      return toWireInventoryItem(deleted)
    }),
})
