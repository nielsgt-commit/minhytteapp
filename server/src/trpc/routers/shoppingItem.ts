import { and, asc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import {
  shoppingItemAssigneesTable,
  shoppingListItemsTable,
} from "../../db/schema/shopping.schema.ts"
import { wireMap } from "../util/wire.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import {
  assertUserIsPropertyMember,
  resolvePropertyIdFromShoppingItem,
} from "../util/propertyAccess.ts"

// Wire mapping: created_at (timestamp) → Temporal.Instant.
const toWireShoppingItem = wireMap({ created_at: "instant" })

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
    const assigneeRows = await ctx.db
      .select({
        item_id: shoppingItemAssigneesTable.item_id,
        user_id: shoppingItemAssigneesTable.user_id,
      })
      .from(shoppingItemAssigneesTable)
      .innerJoin(
        shoppingListItemsTable,
        eq(shoppingListItemsTable.id, shoppingItemAssigneesTable.item_id),
      )
      .where(eq(shoppingListItemsTable.property_id, input.property_id))
      .orderBy(shoppingItemAssigneesTable.id)
    const assigneesByItem = new Map<number, number[]>()
    for (const a of assigneeRows) {
      const list = assigneesByItem.get(a.item_id)
      if (list) list.push(a.user_id)
      else assigneesByItem.set(a.item_id, [a.user_id])
    }
    return rows.map(row => ({
      ...toWireShoppingItem(row),
      assignee_ids: assigneesByItem.get(row.id) ?? [],
    }))
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
        .set({
          ...rest,
          ...(input.checked !== undefined && {
            checked_by: input.checked ? ctx.user.id : null,
          }),
        })
        .where(eq(shoppingListItemsTable.id, id))
        .returning()
      return toWireShoppingItem(updated)
    }),

  setAssignee: propertyAdminProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        id: z.number().int().positive(),
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolvePropertyIdFromShoppingItem(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "shopping item does not belong to this property",
        })
      }
      await assertUserIsPropertyMember(ctx.db, input.user_id, input.property_id)
      await ctx.db
        .insert(shoppingItemAssigneesTable)
        .values({ item_id: input.id, user_id: input.user_id })
        .onConflictDoNothing()
      return { ok: true as const }
    }),

  removeAssignee: propertyAdminProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        id: z.number().int().positive(),
        user_id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolvePropertyIdFromShoppingItem(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "shopping item does not belong to this property",
        })
      }
      await ctx.db
        .delete(shoppingItemAssigneesTable)
        .where(
          and(
            eq(shoppingItemAssigneesTable.item_id, input.id),
            eq(shoppingItemAssigneesTable.user_id, input.user_id),
          ),
        )
      return { ok: true as const }
    }),

  clearSection: propertyAdminProcedure
    .input(z.object({ section: sectionEnum }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(shoppingListItemsTable)
        .where(
          and(
            eq(shoppingListItemsTable.property_id, input.property_id),
            eq(shoppingListItemsTable.section, input.section),
          ),
        )
        .returning()
      return { deleted: deleted.length }
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
