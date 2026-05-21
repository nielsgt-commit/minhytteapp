import { asc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import {
  equipmentTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const equipmentFields = {
  name: z.string().min(1, { error: "name is required" }).max(255),
  property_id: z.number().int().positive(),
  brand: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  category: z.string().max(32).optional(),
  notes: z.string().max(255).optional(),
}

const createInput = z.object(equipmentFields)
const updateInput = z.object({
  id: z.number().int().positive(),
  ...equipmentFields,
})

const scheduleMaintenanceInput = z.object({
  equipment_id: z.number().int().positive(),
  description: z.string().min(1, { error: "description is required" }).max(255),
  instructions: z.string().max(255).optional(),
  added_by: z.number().int().positive(),
  assigned_to_id: z.number().int().positive().optional(),
  category: z.enum(["maintenance", "repair"]).default("maintenance"),
  severity: z.enum(["major", "minor", "patch"]).default("minor"),
  recurrence: z.enum(["once", "yearly", "5year"]).default("once"),
  due_at: z.coerce.date().optional(),
})

export const equipmentRouter = router({
  listForProperty: publicProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(equipmentTable)
        .where(eq(equipmentTable.property_id, input.property_id))
        .orderBy(asc(equipmentTable.id))
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(equipmentTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(equipmentTable)
        .set(rest)
        .where(eq(equipmentTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(equipmentTable)
        .where(eq(equipmentTable.id, input.id))
        .returning()
      return deleted
    }),

  scheduleMaintenance: protectedProcedure
    .input(scheduleMaintenanceInput)
    .mutation(async ({ ctx, input }) => {
      const equipment = (
        await ctx.db
          .select()
          .from(equipmentTable)
          .where(eq(equipmentTable.id, input.equipment_id))
          .limit(1)
      ).at(0)
      if (!equipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "equipment not found",
        })
      }
      const [created] = await ctx.db
        .insert(maintenanceTable)
        .values({
          description: input.description,
          instructions: input.instructions,
          added_by: input.added_by,
          assigned_to_id: input.assigned_to_id,
          equipment_id: equipment.id,
          category: input.category,
          severity: input.severity,
          status: "todo",
          recurrence: input.recurrence,
          due_at: input.due_at,
        })
        .returning()
      return created
    }),
})
