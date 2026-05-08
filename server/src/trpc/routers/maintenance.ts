import { asc, eq, or } from "drizzle-orm"
import { z } from "zod"
import { maintenanceTable } from "../../db/schema/maintenance.schema.ts"
import {
  buildingsTable,
  placeTable,
} from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const maintenanceFields = {
  description: z.string().min(1),
  instructions: z.string().optional(),
  added_by: z.number().int().positive(),
  assigned_to_id: z.number().int().positive().optional(),
  building_id: z.number().int().positive().optional(),
  place_id: z.number().int().positive().optional(),
  category: z.enum(["maintenance", "repair"]),
  severity: z.enum(["major", "minor", "patch"]),
  status: z.enum(["todo", "doing", "done"]),
  recurrence: z.enum(["once", "yearly", "5year"]),
}

const locationXor = {
  check: (v: { building_id?: number; place_id?: number }) =>
    (v.building_id != null) !== (v.place_id != null),
  error: "exactly one of building_id or place_id must be set",
  path: ["place_id"] as const,
}

const createInput = z
  .object(maintenanceFields)
  .refine(locationXor.check, {
    error: locationXor.error,
    path: [...locationXor.path],
  })

const updateInput = z
  .object({ id: z.number().int().positive(), ...maintenanceFields })
  .refine(locationXor.check, {
    error: locationXor.error,
    path: [...locationXor.path],
  })

export const maintenanceRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(maintenanceTable)
      .orderBy(asc(maintenanceTable.created_at))
  }),

  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ m: maintenanceTable })
        .from(maintenanceTable)
        .leftJoin(
          buildingsTable,
          eq(buildingsTable.id, maintenanceTable.building_id),
        )
        .leftJoin(placeTable, eq(placeTable.id, maintenanceTable.place_id))
        .where(
          or(
            eq(buildingsTable.property_id, input.property_id),
            eq(placeTable.property_id, input.property_id),
          ),
        )
        .orderBy(asc(maintenanceTable.created_at))
      return rows.map(r => r.m)
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(maintenanceTable)
        .values({
          ...input,
          completed_at: input.status === "done" ? new Date() : null,
        })
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(maintenanceTable)
        .set({
          ...rest,
          completed_at: rest.status === "done" ? new Date() : null,
        })
        .where(eq(maintenanceTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(maintenanceTable)
        .where(eq(maintenanceTable.id, input.id))
        .returning()
      return deleted
    }),
})