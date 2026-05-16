import { asc, eq, or } from "drizzle-orm"
import { z } from "zod"
import { maintenanceTable } from "../../db/schema/maintenance.schema.ts"
import {
  structuresTable,
  infrastructureTable,
} from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const maintenanceFields = {
  description: z.string().min(1),
  instructions: z.string().optional(),
  added_by: z.number().int().positive(),
  assigned_to_id: z.number().int().positive().optional(),
  structure_id: z.number().int().positive().optional(),
  infrastructure_id: z.number().int().positive().optional(),
  category: z.enum(["maintenance", "repair"]),
  severity: z.enum(["major", "minor", "patch"]),
  status: z.enum(["todo", "doing", "done"]),
  recurrence: z.enum(["once", "yearly", "5year"]),
}

const locationXor = {
  check: (v: { structure_id?: number; infrastructure_id?: number }) =>
    (v.structure_id != null) !== (v.infrastructure_id != null),
  error: "exactly one of structure_id or infrastructure_id must be set",
  path: ["infrastructure_id"] as const,
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
          structuresTable,
          eq(structuresTable.id, maintenanceTable.structure_id),
        )
        .leftJoin(infrastructureTable, eq(infrastructureTable.id, maintenanceTable.infrastructure_id))
        .where(
          or(
            eq(structuresTable.property_id, input.property_id),
            eq(infrastructureTable.property_id, input.property_id),
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

  setPinned: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        is_pinned: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(maintenanceTable)
        .set({ is_pinned: input.is_pinned })
        .where(eq(maintenanceTable.id, input.id))
        .returning()
      return updated
    }),

  setProcedureOrder: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async tx => {
        for (let i = 0; i < input.ids.length; i++) {
          await tx
            .update(maintenanceTable)
            .set({ procedure_position: i })
            .where(eq(maintenanceTable.id, input.ids[i]))
        }
      })
      return { ok: true as const }
    }),
})