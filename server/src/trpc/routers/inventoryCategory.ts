import { TRPCError } from "@trpc/server"
import { and, asc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import {
  inventoryCategoriesTable,
  inventoryItemsTable,
} from "../../db/schema/inventory.schema.ts"
import { INVENTORY_CATEGORY_KINDS } from "../../shared/inventoryCategoryDefaults.ts"
import { wireMap } from "../util/wire.ts"
import {
  propertyAdminProcedure,
  propertyHeadProcedure,
  router,
} from "../init.ts"

// Auth switch point for category writes: head-only per the equipment/expense
// category pattern. Flip to propertyAdminProcedure (any member) here if
// members should manage categories too.
const categoryWriteProcedure = propertyHeadProcedure

// Wire mapping: archived_at (nullable timestamp) → Temporal.Instant | null.
const toWireCategory = wireMap({ archived_at: "instantOrNull" })

const nameInput = z.string().trim().min(1).max(32)

export const inventoryCategoryRouter = router({
  // Active categories, optionally narrowed to one list's kind. Ordered by id;
  // the client applies the canonical defaults-first order.
  list: propertyAdminProcedure
    .input(z.object({ kind: z.enum(INVENTORY_CATEGORY_KINDS).optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: inventoryCategoriesTable.id,
          name: inventoryCategoriesTable.name,
          kind: inventoryCategoriesTable.kind,
        })
        .from(inventoryCategoriesTable)
        .where(
          and(
            eq(inventoryCategoriesTable.property_id, input.property_id),
            isNull(inventoryCategoriesTable.archived_at),
            input.kind != null
              ? eq(inventoryCategoriesTable.kind, input.kind)
              : undefined,
          ),
        )
        .orderBy(asc(inventoryCategoriesTable.id))
    }),

  create: categoryWriteProcedure
    .input(
      z.object({ name: nameInput, kind: z.enum(INVENTORY_CATEGORY_KINDS) }),
    )
    .mutation(async ({ ctx, input }) => {
      // The partial unique index (property, name, active) absorbs a duplicate
      // race; an empty returning means the name is taken.
      const created = (
        await ctx.db
          .insert(inventoryCategoriesTable)
          .values({
            property_id: input.property_id,
            name: input.name,
            kind: input.kind,
          })
          .onConflictDoNothing()
          .returning()
      ).at(0)
      if (!created) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "a category with this name already exists",
        })
      }
      return toWireCategory(created)
    }),

  rename: categoryWriteProcedure
    .input(z.object({ id: z.number().int().positive(), name: nameInput }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({
            property_id: inventoryCategoriesTable.property_id,
            archived_at: inventoryCategoriesTable.archived_at,
          })
          .from(inventoryCategoriesTable)
          .where(eq(inventoryCategoriesTable.id, input.id))
      ).at(0)
      if (existing?.property_id !== input.property_id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (existing.archived_at != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cannot rename an archived category",
        })
      }
      // Friendly pre-check; the partial unique index is the race backstop.
      const clash = (
        await ctx.db
          .select({ id: inventoryCategoriesTable.id })
          .from(inventoryCategoriesTable)
          .where(
            and(
              eq(inventoryCategoriesTable.property_id, input.property_id),
              eq(inventoryCategoriesTable.name, input.name),
              isNull(inventoryCategoriesTable.archived_at),
            ),
          )
      ).at(0)
      if (clash != null && clash.id !== input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "a category with this name already exists",
        })
      }
      // Items reference categories by id, so a rename needs no item sync.
      const [renamed] = await ctx.db
        .update(inventoryCategoriesTable)
        .set({ name: input.name })
        .where(eq(inventoryCategoriesTable.id, input.id))
        .returning()
      return toWireCategory(renamed)
    }),

  archive: categoryWriteProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db
          .select({ property_id: inventoryCategoriesTable.property_id })
          .from(inventoryCategoriesTable)
          .where(eq(inventoryCategoriesTable.id, input.id))
      ).at(0)
      if (existing?.property_id !== input.property_id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      // Items reference categories by id (not a copied name), so archiving an
      // in-use category would orphan its items off both lists. Block instead;
      // the archive-empty rule keeps the lists' grouping total.
      const inUse = (
        await ctx.db
          .select({ id: inventoryItemsTable.id })
          .from(inventoryItemsTable)
          .where(eq(inventoryItemsTable.category_id, input.id))
          .limit(1)
      ).at(0)
      if (inUse != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "this category still has items; move or delete them first",
        })
      }
      const [archived] = await ctx.db
        .update(inventoryCategoriesTable)
        .set({ archived_at: new Date() })
        .where(eq(inventoryCategoriesTable.id, input.id))
        .returning()
      return toWireCategory(archived)
    }),
})
