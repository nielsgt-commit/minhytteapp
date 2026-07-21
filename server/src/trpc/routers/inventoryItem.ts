import { and, asc, eq, isNull } from "drizzle-orm"
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
import { ALL_SECTIONS } from "../../shared/inventorySections.ts"

type Db = typeof dbClient

// Wire mapping: created_at/updated_at (timestamp) → Temporal.Instant.
const toWireInventoryItem = wireMap({
  created_at: "instant",
  updated_at: "instantOrNull",
})

// Sections exist as per-property category rows; a property gets each lazily on
// first write rather than via a creation-hook, so every creation path
// (property router, seed scripts) is covered. Race-safe: the partial unique
// index absorbs a concurrent insert and the re-select picks up the winner's
// row.
async function ensureCategoryId(
  db: Db,
  propertyId: number,
  name: string,
): Promise<number> {
  const find = async () =>
    (
      await db
        .select({ id: inventoryCategoriesTable.id })
        .from(inventoryCategoriesTable)
        .where(
          and(
            eq(inventoryCategoriesTable.property_id, propertyId),
            eq(inventoryCategoriesTable.name, name),
            isNull(inventoryCategoriesTable.archived_at),
          ),
        )
        .limit(1)
    ).at(0)
  const existing = await find()
  if (existing) return existing.id
  const created = (
    await db
      .insert(inventoryCategoriesTable)
      .values({ property_id: propertyId, name })
      .onConflictDoNothing()
      .returning()
  ).at(0)
  if (created) return created.id
  const winner = await find()
  if (!winner) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" })
  }
  return winner.id
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

const createInput = z.object({
  property_id: z.number().int().positive(),
  name: z.string().min(1, { error: "name is required" }).max(255),
  category: z.enum(ALL_SECTIONS),
  ...optionalFields,
})

const updateInput = z.object({
  property_id: z.number().int().positive(),
  id: z.number().int().positive(),
  name: z.string().min(1, { error: "name is required" }).max(255).optional(),
  category: z.enum(ALL_SECTIONS).optional(),
  ...optionalFields,
})

// The wire carries the category NAME (the section), not category_id: the
// name is what the client groups by, and it keeps optimistic cache rows
// constructible without inventing a category id.
const wireColumns = {
  id: inventoryItemsTable.id,
  property_id: inventoryItemsTable.property_id,
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
      .select({ ...wireColumns, category: inventoryCategoriesTable.name })
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
      const categoryId = await ensureCategoryId(
        ctx.db,
        input.property_id,
        input.category,
      )
      const [created] = await ctx.db
        .insert(inventoryItemsTable)
        .values({
          property_id: input.property_id,
          category_id: categoryId,
          name: input.name,
          quantity: input.quantity ?? null,
          location: emptyToNull(input.location),
          ...refs,
          created_by: ctx.user.id,
        })
        .returning(wireColumns)
      return { ...toWireInventoryItem(created), category: input.category }
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
      if (input.category !== undefined) {
        patch.category_id = await ensureCategoryId(
          ctx.db,
          input.property_id,
          input.category,
        )
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
        .returning({
          ...wireColumns,
          category_id: inventoryItemsTable.category_id,
        })
      const category =
        input.category ??
        (
          await ctx.db
            .select({ name: inventoryCategoriesTable.name })
            .from(inventoryCategoriesTable)
            .where(eq(inventoryCategoriesTable.id, updated.category_id))
            .limit(1)
        )[0].name
      const { category_id: _categoryId, ...row } = updated
      return { ...toWireInventoryItem(row), category }
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
