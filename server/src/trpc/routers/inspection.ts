import { asc, eq, or } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  buildingsTable,
  placeTable,
} from "../../db/schema/property.schema.ts"
import { protectedProcedure, router } from "../init.ts"

const targetXor = {
  check: (v: {
    building_id?: number
    place_id?: number
    equipment_id?: number
  }) =>
    [v.building_id, v.place_id, v.equipment_id].filter(x => x != null).length
    === 1,
  error: "exactly one of building_id, place_id, equipment_id must be set",
}

const recurrenceEnum = z.enum(["once", "yearly", "5year"])

const startInput = z
  .object({
    building_id: z.number().int().positive().optional(),
    place_id: z.number().int().positive().optional(),
    equipment_id: z.number().int().positive().optional(),
    started_by_user_id: z.number().int().positive(),
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
  notes: z.string().max(2000).optional(),
  added_by: z.number().int().positive(),
  findings: z.array(findingSchema),
})

const recordInput = z
  .object({
    building_id: z.number().int().positive().optional(),
    place_id: z.number().int().positive().optional(),
    equipment_id: z.number().int().positive().optional(),
    started_by_user_id: z.number().int().positive(),
    inspected_by: z.string().min(1).max(255),
    recurrence: recurrenceEnum,
    notes: z.string().max(2000).optional(),
    added_by: z.number().int().positive(),
    findings: z.array(findingSchema),
  })
  .refine(targetXor.check, { error: targetXor.error })

export const inspectionRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ i: inspectionsTable })
        .from(inspectionsTable)
        .leftJoin(
          buildingsTable,
          eq(buildingsTable.id, inspectionsTable.building_id),
        )
        .leftJoin(placeTable, eq(placeTable.id, inspectionsTable.place_id))
        .leftJoin(
          equipmentTable,
          eq(equipmentTable.id, inspectionsTable.equipment_id),
        )
        .where(
          or(
            eq(buildingsTable.property_id, input.property_id),
            eq(placeTable.property_id, input.property_id),
            eq(equipmentTable.property_id, input.property_id),
          ),
        )
        .orderBy(asc(inspectionsTable.started_at))
      return rows.map(r => r.i)
    }),

  listFindings: protectedProcedure
    .input(z.object({ inspection_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(maintenanceTable)
        .where(eq(maintenanceTable.inspection_id, input.inspection_id))
        .orderBy(asc(maintenanceTable.created_at))
    }),

  start: protectedProcedure
    .input(startInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(inspectionsTable)
        .values({
          building_id: input.building_id,
          place_id: input.place_id,
          equipment_id: input.equipment_id,
          started_by_user_id: input.started_by_user_id,
          inspected_by: input.inspected_by,
          recurrence: input.recurrence,
        })
        .returning()
      return created
    }),

  complete: protectedProcedure
    .input(completeInput)
    .mutation(async ({ ctx, input }) => {
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

        let equipmentBuildingId: number | null = null
        if (existing.equipment_id != null) {
          const found = (
            await tx
              .select({ building_id: equipmentTable.building_id })
              .from(equipmentTable)
              .where(eq(equipmentTable.id, existing.equipment_id))
              .limit(1)
          ).at(0)
          if (!found) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "equipment for inspection not found",
            })
          }
          equipmentBuildingId = found.building_id
        }

        const findingLocation = () => {
          if (existing.place_id != null) {
            return { place_id: existing.place_id }
          }
          // building or equipment target — maintenance row needs building_id set
          // (the XOR check requires exactly one of building_id / place_id)
          return {
            building_id: existing.building_id ?? equipmentBuildingId!,
            equipment_id: existing.equipment_id ?? undefined,
          }
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
            added_by: input.added_by,
            ...findingLocation(),
            category: "maintenance",
            severity: "minor",
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
            notes: input.notes,
            completed_at: new Date(),
          })
          .where(eq(inspectionsTable.id, input.id))
          .returning()
        return updated
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async tx => {
        await tx
          .update(maintenanceTable)
          .set({ inspection_id: null })
          .where(eq(maintenanceTable.inspection_id, input.id))
        const [deleted] = await tx
          .delete(inspectionsTable)
          .where(eq(inspectionsTable.id, input.id))
          .returning()
        return deleted
      })
    }),

  record: protectedProcedure
    .input(recordInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async tx => {
        let equipmentBuildingId: number | null = null
        if (input.equipment_id != null) {
          const found = (
            await tx
              .select({ building_id: equipmentTable.building_id })
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
          equipmentBuildingId = found.building_id
        }

        const now = new Date()
        const [inspection] = await tx
          .insert(inspectionsTable)
          .values({
            building_id: input.building_id,
            place_id: input.place_id,
            equipment_id: input.equipment_id,
            started_by_user_id: input.started_by_user_id,
            inspected_by: input.inspected_by,
            recurrence: input.recurrence,
            notes: input.notes,
            started_at: now,
            completed_at: now,
          })
          .returning()

        const findingLocation = () => {
          if (input.place_id != null) return { place_id: input.place_id }
          return {
            building_id: input.building_id ?? equipmentBuildingId!,
            equipment_id: input.equipment_id ?? undefined,
          }
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
            added_by: input.added_by,
            ...findingLocation(),
            category: "maintenance",
            severity: "minor",
            status,
            recurrence,
            is_pinned: willBePinned,
            parent_maintenance_id: f.pinned_maintenance_id,
            inspection_id: inspection.id,
            completed_at: status === "done" ? now : null,
          })
        }

        return inspection
      })
    }),
})
