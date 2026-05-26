import { asc, eq, or } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { PortableTextBlock } from "@portabletext/types"
import {
  equipmentTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  structuresTable,
  infrastructureTable,
} from "../../db/schema/property.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const maintenanceFields = {
  description: z.string().min(1),
  instructions_pt: z
    .custom<PortableTextBlock[]>(v => v == null || Array.isArray(v))
    .nullish(),
  added_by: z.number().int().positive(),
  assigned_to_id: z.number().int().positive().optional(),
  structure_id: z.number().int().positive().optional(),
  infrastructure_id: z.number().int().positive().optional(),
  equipment_id: z.number().int().positive().optional(),
  category: z.enum(["maintenance", "repair"]),
  severity: z.enum(["major", "minor", "patch"]),
  status: z.enum(["todo", "doing", "done"]),
  recurrence: z.enum(["once", "yearly", "5year", "spring", "fall"]),
  completed_at: z.coerce.date().optional(),
}

const locationXor = {
  check: (v: {
    structure_id?: number
    infrastructure_id?: number
    equipment_id?: number
  }) =>
    [v.structure_id, v.infrastructure_id, v.equipment_id].filter(x => x != null)
      .length === 1,
  error:
    "exactly one of structure_id, infrastructure_id, or equipment_id must be set",
  path: ["equipment_id"] as const,
}

const createInput = z.object(maintenanceFields).refine(locationXor.check, {
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
      .orderBy(asc(maintenanceTable.created_at), asc(maintenanceTable.id))
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
        .leftJoin(
          infrastructureTable,
          eq(infrastructureTable.id, maintenanceTable.infrastructure_id),
        )
        .leftJoin(
          equipmentTable,
          eq(equipmentTable.id, maintenanceTable.equipment_id),
        )
        .where(
          or(
            eq(structuresTable.property_id, input.property_id),
            eq(infrastructureTable.property_id, input.property_id),
            eq(equipmentTable.property_id, input.property_id),
          ),
        )
        .orderBy(asc(maintenanceTable.created_at), asc(maintenanceTable.id))
      return rows.map(r => r.m)
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(maintenanceTable)
        .values({
          ...input,
          completed_at:
            input.status === "done" ? (input.completed_at ?? new Date()) : null,
        })
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const existing = (
        await ctx.db
          .select({ completed_at: maintenanceTable.completed_at })
          .from(maintenanceTable)
          .where(eq(maintenanceTable.id, id))
          .limit(1)
      ).at(0)
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "maintenance not found",
        })
      }
      const completed_at =
        rest.status === "done"
          ? (rest.completed_at ?? existing.completed_at ?? new Date())
          : null
      const [updated] = await ctx.db
        .update(maintenanceTable)
        .set({ ...rest, completed_at })
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
