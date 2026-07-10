import { asc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { equipmentTable } from "../../db/schema/maintenance.schema.ts"
import { wireMap } from "../util/wire.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import { resolvePropertyIdFromEquipment } from "../util/propertyAccess.ts"

// Wire mapping: created_at (timestamp) → Temporal.Instant.
const toWireEquipment = wireMap({ created_at: "instant" })

const equipmentFields = {
  name: z.string().min(1, { error: "name is required" }).max(255),
  property_id: z.number().int().positive(),
  brand: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  category: z.string().max(32).optional(),
  notes: z.string().max(255).optional(),
  acquired_year: z.number().int().min(1500).max(2100).nullable().optional(),
}

const createInput = z.object(equipmentFields)
const updateInput = z.object({
  id: z.number().int().positive(),
  ...equipmentFields,
})

export const equipmentRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(equipmentTable)
      .where(eq(equipmentTable.property_id, input.property_id))
      .orderBy(asc(equipmentTable.id))
    return rows.map(r => toWireEquipment(r))
  }),

  create: propertyAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(equipmentTable)
        .values(input)
        .returning()
      return toWireEquipment(created)
    }),

  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolvePropertyIdFromEquipment(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "cannot reassign equipment to another property",
        })
      }
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(equipmentTable)
        .set(rest)
        .where(eq(equipmentTable.id, id))
        .returning()
      return toWireEquipment(updated)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromEquipment(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [deleted] = await ctx.db
        .delete(equipmentTable)
        .where(eq(equipmentTable.id, input.id))
        .returning()
      return toWireEquipment(deleted)
    }),
})
