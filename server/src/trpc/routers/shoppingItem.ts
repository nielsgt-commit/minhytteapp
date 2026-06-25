import { asc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { shoppingListItemsTable } from "../../db/schema/shopping.schema.ts"
import { type Temporal, instantFromDate } from "../../shared/temporal.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import { resolvePropertyIdFromShoppingItem } from "../util/propertyAccess.ts"

// Wire mapping: created_at (timestamp) → Temporal.Instant.
function toWireShoppingItem<T extends { created_at: Date }>(
  i: T,
): Omit<T, "created_at"> & { created_at: Temporal.Instant } {
  return { ...i, created_at: instantFromDate(i.created_at) }
}

const sectionEnum = z.enum(["food", "other"])

const createInput = z.object({
  property_id: z.number().int().positive(),
  section: sectionEnum,
  name: z.string().min(1, { error: "name is required" }).max(255),
})

const updateInput = z.object({
  property_id: z.number().int().positive(),
  id: z.number().int().positive(),
  name: z.string().min(1, { error: "name is required" }).max(255).optional(),
  section: sectionEnum.optional(),
  checked: z.boolean().optional(),
})

export const shoppingItemRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(shoppingListItemsTable)
      .where(eq(shoppingListItemsTable.property_id, input.property_id))
      .orderBy(asc(shoppingListItemsTable.id))
    return rows.map(toWireShoppingItem)
  }),

  create: propertyAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(shoppingListItemsTable)
        .values({ ...input, created_by: ctx.user.id })
        .returning()
      return toWireShoppingItem(created)
    }),

  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolvePropertyIdFromShoppingItem(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "cannot reassign shopping item to another property",
        })
      }
      const { id, property_id: _property_id, ...rest } = input
      const [updated] = await ctx.db
        .update(shoppingListItemsTable)
        .set(rest)
        .where(eq(shoppingListItemsTable.id, id))
        .returning()
      return toWireShoppingItem(updated)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromShoppingItem(
        ctx.db,
        input.id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [deleted] = await ctx.db
        .delete(shoppingListItemsTable)
        .where(eq(shoppingListItemsTable.id, input.id))
        .returning()
      return toWireShoppingItem(deleted)
    }),
})
