import { and, asc, eq, isNull, or } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { PortableTextBlock } from "@portabletext/types"
import {
  equipmentTable,
  maintenanceTable,
  procedureStepsTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  infrastructureTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import {
  type Temporal,
  instantFromDate,
  instantFromDateOrNull,
} from "../../shared/temporal.ts"
import { assertPropertyMember, protectedProcedure, router } from "../init.ts"
import {
  resolvePropertyIdFromMaintenance,
  resolvePropertyIdFromMaintenanceParent,
  resolvePropertyIdFromProcedureStep,
} from "../util/propertyAccess.ts"

// Wire mapping: procedure-step timestamp columns (JS Date) → Temporal.Instant.
export function toWireProcedureStep<
  T extends { created_at: Date; archived_at: Date | null },
>(
  s: T,
): Omit<T, "created_at" | "archived_at"> & {
  created_at: Temporal.Instant
  archived_at: Temporal.Instant | null
} {
  return {
    ...s,
    created_at: instantFromDate(s.created_at),
    archived_at: instantFromDateOrNull(s.archived_at),
  }
}

export const procedureStepRouter = router({
  // Active (non-archived) procedure steps for the property. The inspection flow
  // filters these by location and orders by `position`.
  listForProperty: protectedProcedure
    .input(z.object({ property_id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPropertyMember(ctx.db, ctx.user, input.property_id)
      const rows = await ctx.db
        .select({ s: procedureStepsTable })
        .from(procedureStepsTable)
        .leftJoin(
          structuresTable,
          eq(structuresTable.id, procedureStepsTable.structure_id),
        )
        .leftJoin(
          infrastructureTable,
          eq(infrastructureTable.id, procedureStepsTable.infrastructure_id),
        )
        .leftJoin(
          equipmentTable,
          eq(equipmentTable.id, procedureStepsTable.equipment_id),
        )
        .where(
          and(
            isNull(procedureStepsTable.archived_at),
            or(
              eq(structuresTable.property_id, input.property_id),
              eq(infrastructureTable.property_id, input.property_id),
              eq(equipmentTable.property_id, input.property_id),
            ),
          ),
        )
        .orderBy(
          asc(procedureStepsTable.position),
          asc(procedureStepsTable.created_at),
        )
      return rows.map(r => toWireProcedureStep(r.s))
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        description: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromProcedureStep(
        ctx.db,
        input.id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [updated] = await ctx.db
        .update(procedureStepsTable)
        .set({ description: input.description })
        .where(eq(procedureStepsTable.id, input.id))
        .returning()
      return toWireProcedureStep(updated)
    }),

  setOrder: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { ok: true as const }
      const propertyIds = await Promise.all(
        input.ids.map(id => resolvePropertyIdFromProcedureStep(ctx.db, id)),
      )
      const first = propertyIds[0]
      if (propertyIds.some(p => p !== first)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "all procedure step ids must belong to the same property",
        })
      }
      await assertPropertyMember(ctx.db, ctx.user, first)
      await ctx.db.transaction(async tx => {
        for (let i = 0; i < input.ids.length; i++) {
          await tx
            .update(procedureStepsTable)
            .set({ position: i })
            .where(eq(procedureStepsTable.id, input.ids[i]))
        }
      })
      return { ok: true as const }
    }),

  // "Remove from procedure" — archive rather than delete so the step stops
  // recurring while inspection history (created_in_inspection_id, raised
  // followups) is preserved. Replaces the former setPinned(false) unpin.
  archive: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromProcedureStep(
        ctx.db,
        input.id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [updated] = await ctx.db
        .update(procedureStepsTable)
        .set({ archived_at: new Date() })
        .where(eq(procedureStepsTable.id, input.id))
        .returning()
      return toWireProcedureStep(updated)
    }),

  // Promote a todo into a recurring procedure step: copy its description,
  // instructions and location into a new step, then drop the todo (it "becomes"
  // the step). The flow back out is the inspection "needs followup" path, which
  // raises a fresh todo with maintenance.source_step_id set.
  promoteFromMaintenance: protectedProcedure
    .input(z.object({ maintenance_id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromMaintenance(
        ctx.db,
        input.maintenance_id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      return ctx.db.transaction(async tx => {
        const todo = (
          await tx
            .select({
              description: maintenanceTable.description,
              instructions_pt: maintenanceTable.instructions_pt,
              structure_id: maintenanceTable.structure_id,
              infrastructure_id: maintenanceTable.infrastructure_id,
              equipment_id: maintenanceTable.equipment_id,
            })
            .from(maintenanceTable)
            .where(eq(maintenanceTable.id, input.maintenance_id))
            .limit(1)
        ).at(0)
        if (!todo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "maintenance not found",
          })
        }
        const [created] = await tx
          .insert(procedureStepsTable)
          .values({
            description: todo.description,
            instructions_pt: todo.instructions_pt,
            structure_id: todo.structure_id,
            infrastructure_id: todo.infrastructure_id,
            equipment_id: todo.equipment_id,
            added_by: ctx.user.id,
          })
          .returning()
        await tx
          .delete(maintenanceTable)
          .where(eq(maintenanceTable.id, input.maintenance_id))
        return toWireProcedureStep(created)
      })
    }),

  // Add a step directly (outside an inspection), e.g. when first building a
  // location's procedure.
  create: protectedProcedure
    .input(
      z
        .object({
          structure_id: z.number().int().positive().optional(),
          infrastructure_id: z.number().int().positive().optional(),
          equipment_id: z.number().int().positive().optional(),
          description: z.string().min(1).max(255),
          instructions_pt: z
            .custom<PortableTextBlock[]>(v => v == null || Array.isArray(v))
            .nullish(),
        })
        .refine(
          v =>
            [v.structure_id, v.infrastructure_id, v.equipment_id].filter(
              x => x != null,
            ).length === 1,
          {
            error:
              "exactly one of structure_id, infrastructure_id, equipment_id must be set",
          },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromMaintenanceParent(
        ctx.db,
        input,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [created] = await ctx.db
        .insert(procedureStepsTable)
        .values({
          structure_id: input.structure_id,
          infrastructure_id: input.infrastructure_id,
          equipment_id: input.equipment_id,
          description: input.description,
          instructions_pt: input.instructions_pt,
          added_by: ctx.user.id,
        })
        .returning()
      return toWireProcedureStep(created)
    }),
})
