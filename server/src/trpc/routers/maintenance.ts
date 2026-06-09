import { asc, eq, or } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { PortableTextBlock } from "@portabletext/types"
import {
  type DueKind,
  dueKindValues,
  equipmentTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  structuresTable,
  infrastructureTable,
} from "../../db/schema/property.schema.ts"
import { assertPropertyMember, protectedProcedure, router } from "../init.ts"
import {
  resolvePropertyIdFromMaintenance,
  resolvePropertyIdFromMaintenanceParent,
} from "../util/propertyAccess.ts"
import { ensureMainGroupOfProperty } from "./priority.ts"

const maintenanceFields = {
  description: z.string().min(1),
  instructions_pt: z
    .custom<PortableTextBlock[]>(v => v == null || Array.isArray(v))
    .nullish(),
  assigned_to_id: z.number().int().positive().optional(),
  structure_id: z.number().int().positive().optional(),
  infrastructure_id: z.number().int().positive().optional(),
  equipment_id: z.number().int().positive().optional(),
  category: z.enum(["maintenance", "repair"]),
  severity: z.enum(["major", "minor", "patch"]),
  status: z.enum(["todo", "doing", "done"]),
  recurrence: z.enum(["once", "yearly", "5year", "spring", "fall"]),
  due_kind: z.enum(dueKindValues).default("not_decided"),
  due_priority_group_id: z.number().int().positive().optional(),
  due_at: z.coerce.date().optional(),
  completed_at: z.coerce.date().optional(),
}

type DueInput = {
  due_kind: DueKind
  due_priority_group_id?: number
  due_at?: Date
}

const dueShape = {
  // Only assert what normalizeDue() can't supply on its own: 'date' needs a
  // due_at, 'priority_week' needs a group. The "and the other field must be
  // null" clauses are intentionally dropped — normalizeDue() nulls irrelevant
  // columns before insert/update, so a stray due_at on a non-date kind is
  // sanitized rather than 400-ing. The DB CHECK maintenance_due_shape remains
  // the hard backstop.
  check: (v: DueInput) => {
    switch (v.due_kind) {
      case "date":
        return v.due_at != null
      case "priority_week":
        return v.due_priority_group_id != null
      default:
        return true
    }
  },
  error:
    "due_at is required for kind 'date'; due_priority_group_id is required for 'priority_week'",
  path: ["due_kind"] as const,
}

function normalizeDue(input: DueInput) {
  return {
    due_kind: input.due_kind,
    due_at: input.due_kind === "date" ? (input.due_at ?? null) : null,
    due_priority_group_id:
      input.due_kind === "priority_week"
        ? (input.due_priority_group_id ?? null)
        : null,
  }
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

const createInput = z
  .object(maintenanceFields)
  .refine(locationXor.check, {
    error: locationXor.error,
    path: [...locationXor.path],
  })
  .refine(dueShape.check, { error: dueShape.error, path: [...dueShape.path] })

const updateInput = z
  .object({ id: z.number().int().positive(), ...maintenanceFields })
  .refine(locationXor.check, {
    error: locationXor.error,
    path: [...locationXor.path],
  })
  .refine(dueShape.check, { error: dueShape.error, path: [...dueShape.path] })

export const maintenanceRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
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
      const propertyId = await resolvePropertyIdFromMaintenanceParent(
        ctx.db,
        input,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      // A priority_week due must reference a family group of THIS property —
      // the FK alone allows any existing group (cross-property) or 500s on a
      // non-existent id.
      if (input.due_kind === "priority_week" && input.due_priority_group_id) {
        await ensureMainGroupOfProperty(
          ctx.db,
          input.due_priority_group_id,
          propertyId,
        )
      }
      const [created] = await ctx.db
        .insert(maintenanceTable)
        .values({
          ...input,
          ...normalizeDue(input),
          added_by: ctx.user.id,
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
      const propertyId = await resolvePropertyIdFromMaintenance(ctx.db, id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      if (rest.due_kind === "priority_week" && rest.due_priority_group_id) {
        await ensureMainGroupOfProperty(
          ctx.db,
          rest.due_priority_group_id,
          propertyId,
        )
      }
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
        .set({ ...rest, ...normalizeDue(rest), completed_at })
        .where(eq(maintenanceTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromMaintenance(
        ctx.db,
        input.id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
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
      const propertyId = await resolvePropertyIdFromMaintenance(
        ctx.db,
        input.id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
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
      if (input.ids.length === 0) return { ok: true as const }
      const propertyIds = await Promise.all(
        input.ids.map(id => resolvePropertyIdFromMaintenance(ctx.db, id)),
      )
      const first = propertyIds[0]
      if (propertyIds.some(p => p !== first)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "all maintenance ids must belong to the same property",
        })
      }
      await assertPropertyMember(ctx.db, ctx.user, first)
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
