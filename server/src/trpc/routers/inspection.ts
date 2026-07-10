import { and, asc, eq, inArray, or } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { PortableTextBlock } from "@portabletext/types"
import type { db as dbClient } from "../../db/client.ts"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceTable,
  procedureStepsTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  structuresTable,
  infrastructureTable,
} from "../../db/schema/property.schema.ts"
import { userGroupsTable } from "../../db/schema/users.schema.ts"
import { wireMap } from "../util/wire.ts"
import { assertPropertyMember, protectedProcedure, router } from "../init.ts"
import {
  resolvePropertyIdFromInspection,
  resolvePropertyIdFromMaintenanceParent,
} from "../util/propertyAccess.ts"
import { toWireMaintenance } from "./maintenance.ts"
import { ensureMainGroupOfProperty } from "./priority.ts"
import { toWireProcedureStep } from "./procedureStep.ts"

// A db transaction handle, for the shared finding processor below.
type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0]

// Exactly one of these is set — the inspection's (and its findings') location.
type Location =
  | { structure_id: number }
  | { infrastructure_id: number }
  | { equipment_id: number }

// Wire mapping: inspection timestamp columns → Temporal.Instant.
const toWireInspection = wireMap({
  started_at: "instant",
  completed_at: "instantOrNull",
})

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

// New inspections pick from these cadences; "yearly"/"5year" are legacy-only
// (still stored/read, never offered). priority_week additionally needs a group.
const recurrenceEnum = z.enum([
  "spring",
  "fall",
  "dugnad",
  "opening",
  "closing",
  "priority_week",
])

const cadenceShape = {
  check: (v: {
    recurrence: z.infer<typeof recurrenceEnum>
    cadence_priority_group_id?: number
  }) => v.recurrence !== "priority_week" || v.cadence_priority_group_id != null,
  error: "cadence_priority_group_id is required for recurrence 'priority_week'",
  path: ["cadence_priority_group_id"] as const,
}

// Null the group unless the cadence is priority_week, so a stray id can't slip
// past the DB CHECK on a non-priority_week cadence.
function normalizeCadence(v: {
  recurrence: z.infer<typeof recurrenceEnum>
  cadence_priority_group_id?: number
}) {
  return {
    recurrence: v.recurrence,
    cadence_priority_group_id:
      v.recurrence === "priority_week"
        ? (v.cadence_priority_group_id ?? null)
        : null,
  }
}

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
    cadence_priority_group_id: z.number().int().positive().optional(),
  })
  .refine(targetXor.check, { error: targetXor.error })
  .refine(cadenceShape.check, {
    error: cadenceShape.error,
    path: [...cadenceShape.path],
  })

// A finding is one of three explicit kinds, mirroring the inspection UI:
//  - step_result: a verdict on an existing procedure step. "followup" raises a
//    one-off todo linked to that step; "ok" records nothing.
//  - new_step: a step added to the procedure this inspection. An optional
//    followup_description also raises a todo linked to the new step this cycle.
//  - ad_hoc: a finding outside the procedure. `pin` promotes it into a new
//    procedure step instead of raising a todo.
const findingSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("step_result"),
    step_id: z.number().int().positive(),
    status: z.enum(["ok", "followup"]),
    followup_description: z.string().min(1).max(255).optional(),
  }),
  z.object({
    kind: z.literal("new_step"),
    description: z.string().min(1).max(255),
    followup_description: z.string().min(1).max(255).optional(),
  }),
  z.object({
    kind: z.literal("ad_hoc"),
    description: z.string().min(1).max(255),
    pin: z.boolean(),
  }),
])

type Finding = z.infer<typeof findingSchema>

const completeInput = z
  .object({
    id: z.number().int().positive(),
    inspected_by: z.string().min(1).max(255),
    recurrence: recurrenceEnum,
    cadence_priority_group_id: z.number().int().positive().optional(),
    notes_pt: notesPtSchema,
    findings: z.array(findingSchema),
  })
  .refine(cadenceShape.check, {
    error: cadenceShape.error,
    path: [...cadenceShape.path],
  })

const recordInput = z
  .object({
    structure_id: z.number().int().positive().optional(),
    infrastructure_id: z.number().int().positive().optional(),
    equipment_id: z.number().int().positive().optional(),
    inspected_by: z.string().min(1).max(255),
    recurrence: recurrenceEnum,
    cadence_priority_group_id: z.number().int().positive().optional(),
    notes_pt: notesPtSchema,
    findings: z.array(findingSchema),
  })
  .refine(targetXor.check, { error: targetXor.error })
  .refine(cadenceShape.check, {
    error: cadenceShape.error,
    path: [...cadenceShape.path],
  })

// Narrow an inspection row / record-input's three nullable location columns to
// the single set one.
function inspectionLocation(row: {
  structure_id?: number | null
  infrastructure_id?: number | null
  equipment_id?: number | null
}): Location {
  if (row.infrastructure_id != null)
    return { infrastructure_id: row.infrastructure_id }
  if (row.equipment_id != null) return { equipment_id: row.equipment_id }
  if (row.structure_id != null) return { structure_id: row.structure_id }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "one of structure_id, infrastructure_id, or equipment_id required",
  })
}

// Shared insert shape for a one-off todo raised by a finding.
function todoValues(
  description: string,
  location: Location,
  inspectionId: number,
  userId: number,
  sourceStepId: number | null,
) {
  return {
    description,
    added_by: userId,
    ...location,
    category: "maintenance" as const,
    severity: "patch" as const,
    status: "todo" as const,
    recurrence: "once" as const,
    source_step_id: sourceStepId,
    inspection_id: inspectionId,
    completed_at: null,
  }
}

// Apply an inspection's findings: create procedure steps for pinned ad-hocs and
// new steps, and raise one-off todos for followups. Shared by record/complete.
async function processFindings(
  tx: Tx,
  opts: {
    findings: Finding[]
    location: Location
    inspectionId: number
    userId: number
  },
) {
  const { findings, location, inspectionId, userId } = opts

  // Validate referenced steps belong to this inspection's location before
  // linking todos to them (app-layer authz — a step_id from elsewhere must not
  // be linkable across the location/property boundary).
  const stepIds = findings
    .filter(f => f.kind === "step_result")
    .map(f => f.step_id)
  const validStepIds = new Set<number>()
  if (stepIds.length > 0) {
    const [[col, value]] = Object.entries(location) as [
      [keyof Location, number],
    ]
    const rows = await tx
      .select({ id: procedureStepsTable.id })
      .from(procedureStepsTable)
      .where(
        and(
          inArray(procedureStepsTable.id, stepIds),
          eq(procedureStepsTable[col], value),
        ),
      )
    for (const r of rows) validStepIds.add(r.id)
  }

  for (const f of findings) {
    if (f.kind === "step_result") {
      if (f.status !== "followup") continue
      if (!validStepIds.has(f.step_id)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "procedure step does not belong to this inspection",
        })
      }
      await tx
        .insert(maintenanceTable)
        .values(
          todoValues(
            f.followup_description ?? "Followup",
            location,
            inspectionId,
            userId,
            f.step_id,
          ),
        )
    } else if (f.kind === "new_step") {
      const [step] = await tx
        .insert(procedureStepsTable)
        .values({
          description: f.description,
          ...location,
          added_by: userId,
          created_in_inspection_id: inspectionId,
        })
        .returning()
      if (f.followup_description != null) {
        await tx
          .insert(maintenanceTable)
          .values(
            todoValues(
              f.followup_description,
              location,
              inspectionId,
              userId,
              step.id,
            ),
          )
      }
    } else {
      // ad_hoc
      if (f.pin) {
        await tx.insert(procedureStepsTable).values({
          description: f.description,
          ...location,
          added_by: userId,
          created_in_inspection_id: inspectionId,
        })
      } else {
        await tx
          .insert(maintenanceTable)
          .values(
            todoValues(f.description, location, inspectionId, userId, null),
          )
      }
    }
  }
}

export const inspectionRouter = router({
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      const rows = await ctx.db
        .select({
          i: inspectionsTable,
          cadence_priority_group_name: userGroupsTable.name,
        })
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
        .leftJoin(
          userGroupsTable,
          eq(userGroupsTable.id, inspectionsTable.cadence_priority_group_id),
        )
        .where(
          or(
            eq(structuresTable.property_id, input.property_id),
            eq(infrastructureTable.property_id, input.property_id),
            eq(equipmentTable.property_id, input.property_id),
          ),
        )
        .orderBy(asc(inspectionsTable.started_at))
      return rows.map(r => ({
        ...toWireInspection(r.i),
        cadence_priority_group_name: r.cadence_priority_group_name,
      }))
    }),

  listFindings: protectedProcedure
    .input(z.object({ inspection_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromInspection(
        ctx.db,
        input.inspection_id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const findings = await ctx.db
        .select()
        .from(maintenanceTable)
        .where(eq(maintenanceTable.inspection_id, input.inspection_id))
        .orderBy(asc(maintenanceTable.created_at))
      const stepsAdded = await ctx.db
        .select()
        .from(procedureStepsTable)
        .where(
          eq(procedureStepsTable.created_in_inspection_id, input.inspection_id),
        )
        .orderBy(asc(procedureStepsTable.created_at))
      return {
        findings: findings.map(r => toWireMaintenance(r)),
        stepsAdded: stepsAdded.map(r => toWireProcedureStep(r)),
      }
    }),

  start: protectedProcedure
    .input(startInput)
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromMaintenanceParent(
        ctx.db,
        input,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      if (
        input.recurrence === "priority_week" &&
        input.cadence_priority_group_id != null
      ) {
        await ensureMainGroupOfProperty(
          ctx.db,
          input.cadence_priority_group_id,
          propertyId,
        )
      }
      const [created] = await ctx.db
        .insert(inspectionsTable)
        .values({
          structure_id: input.structure_id,
          infrastructure_id: input.infrastructure_id,
          equipment_id: input.equipment_id,
          started_by_user_id: ctx.user.id,
          inspected_by: input.inspected_by,
          ...normalizeCadence(input),
        })
        .returning()
      return toWireInspection(created)
    }),

  complete: protectedProcedure
    .input(completeInput)
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromInspection(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      if (
        input.recurrence === "priority_week" &&
        input.cadence_priority_group_id != null
      ) {
        await ensureMainGroupOfProperty(
          ctx.db,
          input.cadence_priority_group_id,
          propertyId,
        )
      }
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

        await processFindings(tx, {
          findings: input.findings,
          location: inspectionLocation(existing),
          inspectionId: existing.id,
          userId: ctx.user.id,
        })

        const [updated] = await tx
          .update(inspectionsTable)
          .set({
            inspected_by: input.inspected_by,
            ...normalizeCadence(input),
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
      if (
        input.recurrence === "priority_week" &&
        input.cadence_priority_group_id != null
      ) {
        await ensureMainGroupOfProperty(
          ctx.db,
          input.cadence_priority_group_id,
          propertyId,
        )
      }
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
            ...normalizeCadence(input),
            notes_pt: input.notes_pt,
            started_at: now,
            completed_at: now,
          })
          .returning()

        await processFindings(tx, {
          findings: input.findings,
          location: inspectionLocation(input),
          inspectionId: inspection.id,
          userId: ctx.user.id,
        })

        return toWireInspection(inspection)
      })
    }),
})
