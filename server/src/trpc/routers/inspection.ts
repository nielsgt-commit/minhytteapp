import { asc, eq, or } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { PortableTextBlock } from "@portabletext/types"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  structuresTable,
  infrastructureTable,
} from "../../db/schema/property.schema.ts"
import {
  type Temporal,
  instantFromDate,
  instantFromDateOrNull,
} from "../../shared/temporal.ts"
import { assertPropertyMember, protectedProcedure, router } from "../init.ts"
import {
  resolvePropertyIdFromInspection,
  resolvePropertyIdFromMaintenanceParent,
} from "../util/propertyAccess.ts"
import { toWireMaintenance } from "./maintenance.ts"

// Wire mapping: inspection timestamp columns → Temporal.Instant.
function toWireInspection<
  T extends { started_at: Date; completed_at: Date | null },
>(
  i: T,
): Omit<T, "started_at" | "completed_at"> & {
  started_at: Temporal.Instant
  completed_at: Temporal.Instant | null
} {
  return {
    ...i,
    started_at: instantFromDate(i.started_at),
    completed_at: instantFromDateOrNull(i.completed_at),
  }
}

const targetXor = {
  check: (v: {
    structure_id?: number
    infrastructure_id?: number
    equipment_id?: number
  }) =>
    [v.structure_id, v.infrastructure_id, v.equipment_id].filter(x => x != null)
      .length === 1,
  error:
    "exactly one of structure_id, infrastructure_id, equipment_id must be set",
}

const recurrenceEnum = z.enum(["yearly", "5year", "spring", "fall"])

const notesPtSchema = z
  .custom<PortableTextBlock[]>(v => v == null || Array.isArray(v))
  .optional()

const startInput = z
  .object({
    structure_id: z.number().int().positive().optional(),
    infrastructure_id: z.number().int().positive().optional(),
    equipment_id: z.number().int().positive().optional(),
    inspected_by: z.string().min(1).max(255),
    recurrence: recurrenceEnum,
  })
  .refine(targetXor.check, { error: targetXor.error })

const findingSchema = z.object({
  pinned_maintenance_id: z.number().int().positive().optional(),
  description: z.string().min(1).max(255),
  pin: z.boolean(),
  status: z.enum(["ok", "followup"]),
})

const completeInput = z.object({
  id: z.number().int().positive(),
  inspected_by: z.string().min(1).max(255),
  recurrence: recurrenceEnum,
  notes_pt: notesPtSchema,
  findings: z.array(findingSchema),
})

const recordInput = z
  .object({
    structure_id: z.number().int().positive().optional(),
    infrastructure_id: z.number().int().positive().optional(),
    equipment_id: z.number().int().positive().optional(),
    inspected_by: z.string().min(1).max(255),
    recurrence: recurrenceEnum,
    notes_pt: notesPtSchema,
    findings: z.array(findingSchema),
  })
  .refine(targetXor.check, { error: targetXor.error })

export const inspectionRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      const rows = await ctx.db
        .select({ i: inspectionsTable })
        .from(inspectionsTable)
        .leftJoin(
          structuresTable,
          eq(structuresTable.id, inspectionsTable.structure_id),
        )
        .leftJoin(
          infrastructureTable,
          eq(infrastructureTable.id, inspectionsTable.infrastructure_id),
        )
        .leftJoin(
          equipmentTable,
          eq(equipmentTable.id, inspectionsTable.equipment_id),
        )
        .where(
          or(
            eq(structuresTable.property_id, input.property_id),
            eq(infrastructureTable.property_id, input.property_id),
            eq(equipmentTable.property_id, input.property_id),
          ),
        )
        .orderBy(asc(inspectionsTable.started_at))
      return rows.map(r => toWireInspection(r.i))
    }),

  listFindings: protectedProcedure
    .input(z.object({ inspection_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromInspection(
        ctx.db,
        input.inspection_id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const rows = await ctx.db
        .select()
        .from(maintenanceTable)
        .where(eq(maintenanceTable.inspection_id, input.inspection_id))
        .orderBy(asc(maintenanceTable.created_at))
      return rows.map(toWireMaintenance)
    }),

  start: protectedProcedure
    .input(startInput)
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromMaintenanceParent(
        ctx.db,
        input,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [created] = await ctx.db
        .insert(inspectionsTable)
        .values({
          structure_id: input.structure_id,
          infrastructure_id: input.infrastructure_id,
          equipment_id: input.equipment_id,
          started_by_user_id: ctx.user.id,
          inspected_by: input.inspected_by,
          recurrence: input.recurrence,
        })
        .returning()
      return toWireInspection(created)
    }),

  complete: protectedProcedure
    .input(completeInput)
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromInspection(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      return ctx.db.transaction(async tx => {
        const existing = (
          await tx
            .select()
            .from(inspectionsTable)
            .where(eq(inspectionsTable.id, input.id))
            .limit(1)
        ).at(0)
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "inspection not found",
          })
        }
        if (existing.completed_at) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "inspection already completed",
          })
        }

        const findingLocation = () => {
          if (existing.infrastructure_id != null) {
            return { infrastructure_id: existing.infrastructure_id }
          }
          if (existing.equipment_id != null) {
            return { equipment_id: existing.equipment_id }
          }
          if (existing.structure_id == null) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "inspection has no associated structure/infrastructure/equipment",
            })
          }
          return { structure_id: existing.structure_id }
        }

        const toInsert = input.findings.filter(
          f => f.status === "followup" || f.pin,
        )

        for (const f of toInsert) {
          const isAdHoc = f.pinned_maintenance_id == null
          // Ad-hoc + pin: pin the new item to the procedure, mark done now.
          // Ad-hoc no pin: create a one-off todo for followup later.
          // Existing pinned + followup: create a one-off todo linked to parent.
          const willBePinned = isAdHoc && f.pin
          const status = willBePinned ? "done" : "todo"
          const recurrence = willBePinned ? input.recurrence : "once"
          await tx.insert(maintenanceTable).values({
            description: f.description,
            added_by: ctx.user.id,
            ...findingLocation(),
            category: "maintenance",
            severity: "patch",
            status,
            recurrence,
            is_pinned: willBePinned,
            parent_maintenance_id: f.pinned_maintenance_id,
            inspection_id: existing.id,
            completed_at: status === "done" ? new Date() : null,
          })
        }

        const [updated] = await tx
          .update(inspectionsTable)
          .set({
            inspected_by: input.inspected_by,
            recurrence: input.recurrence,
            notes_pt: input.notes_pt,
            completed_at: new Date(),
          })
          .where(eq(inspectionsTable.id, input.id))
          .returning()
        return toWireInspection(updated)
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromInspection(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      return ctx.db.transaction(async tx => {
        await tx
          .update(maintenanceTable)
          .set({ inspection_id: null })
          .where(eq(maintenanceTable.inspection_id, input.id))
        const [deleted] = await tx
          .delete(inspectionsTable)
          .where(eq(inspectionsTable.id, input.id))
          .returning()
        return toWireInspection(deleted)
      })
    }),

  record: protectedProcedure
    .input(recordInput)
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromMaintenanceParent(
        ctx.db,
        input,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      return ctx.db.transaction(async tx => {
        if (input.equipment_id != null) {
          const found = (
            await tx
              .select({ id: equipmentTable.id })
              .from(equipmentTable)
              .where(eq(equipmentTable.id, input.equipment_id))
              .limit(1)
          ).at(0)
          if (!found) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "equipment not found",
            })
          }
        }

        const now = new Date()
        const [inspection] = await tx
          .insert(inspectionsTable)
          .values({
            structure_id: input.structure_id,
            infrastructure_id: input.infrastructure_id,
            equipment_id: input.equipment_id,
            started_by_user_id: ctx.user.id,
            inspected_by: input.inspected_by,
            recurrence: input.recurrence,
            notes_pt: input.notes_pt,
            started_at: now,
            completed_at: now,
          })
          .returning()

        const findingLocation = () => {
          if (input.infrastructure_id != null)
            return { infrastructure_id: input.infrastructure_id }
          if (input.equipment_id != null)
            return { equipment_id: input.equipment_id }
          if (input.structure_id == null) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "one of structure_id, infrastructure_id, or equipment_id is required",
            })
          }
          return { structure_id: input.structure_id }
        }

        const toInsert = input.findings.filter(
          f => f.status === "followup" || f.pin,
        )

        for (const f of toInsert) {
          const isAdHoc = f.pinned_maintenance_id == null
          const willBePinned = isAdHoc && f.pin
          const status = willBePinned ? "done" : "todo"
          const recurrence = willBePinned ? input.recurrence : "once"
          await tx.insert(maintenanceTable).values({
            description: f.description,
            added_by: ctx.user.id,
            ...findingLocation(),
            category: "maintenance",
            severity: "patch",
            status,
            recurrence,
            is_pinned: willBePinned,
            parent_maintenance_id: f.pinned_maintenance_id,
            inspection_id: inspection.id,
            completed_at: status === "done" ? now : null,
          })
        }

        return toWireInspection(inspection)
      })
    }),
})
