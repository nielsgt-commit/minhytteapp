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
import {
  type Temporal,
  dateFromInstant,
  zInstant,
} from "../../shared/temporal.ts"
import { wireMap } from "../util/wire.ts"
import { assertPropertyMember, protectedProcedure, router } from "../init.ts"
import {
  resolvePropertyIdFromMaintenance,
  resolvePropertyIdFromMaintenanceParent,
} from "../util/propertyAccess.ts"
import { ensureMainGroupOfProperty } from "./priority.ts"

// Wire mapping for full maintenance rows (also used by the inspection router's
// listFindings): timestamp columns (JS Date from drizzle) → Temporal.Instant.
export const toWireMaintenance = wireMap({
  due_at: "instantOrNull",
  created_at: "instant",
  completed_at: "instantOrNull",
})

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
  due_at: zInstant.optional(),
  completed_at: zInstant.optional(),
}

type DueInput = {
  due_kind: DueKind
  due_priority_group_id?: number
  due_at?: Temporal.Instant
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
    due_at:
      input.due_kind === "date" && input.due_at != null
        ? dateFromInstant(input.due_at)
        : null,
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
      return rows.map(r => toWireMaintenance(r.m))
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
            input.status === "done"
              ? input.completed_at != null
                ? dateFromInstant(input.completed_at)
                : new Date()
              : null,
        })
        .returning()
      return toWireMaintenance(created)
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
          ? rest.completed_at != null
            ? dateFromInstant(rest.completed_at)
            : (existing.completed_at ?? new Date())
          : null
      const [updated] = await ctx.db
        .update(maintenanceTable)
        .set({ ...rest, ...normalizeDue(rest), completed_at })
        .where(eq(maintenanceTable.id, id))
        .returning()
      return toWireMaintenance(updated)
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
      return toWireMaintenance(deleted)
    }),
})
