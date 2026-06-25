import { desc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { maintenanceTable } from "../../db/schema/maintenance.schema.ts"
import { todosTable } from "../../db/schema/todo.schema.ts"
import { type Temporal, instantFromDate } from "../../shared/temporal.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import {
  resolvePropertyIdFromEquipment,
  resolvePropertyIdFromInfrastructure,
  resolvePropertyIdFromStructure,
  resolvePropertyIdFromTodo,
} from "../util/propertyAccess.ts"

// Wire mapping: created_at (timestamp) → Temporal.Instant.
function toWireTodo<T extends { created_at: Date }>(
  todo: T,
): Omit<T, "created_at"> & { created_at: Temporal.Instant } {
  return { ...todo, created_at: instantFromDate(todo.created_at) }
}

// A targeted todo becomes a maintenance task on the chosen entity. The picker
// supplies exactly one of structure / infrastructure / equipment.
const target = z.object({
  kind: z.enum(["structure", "infrastructure", "equipment"]),
  id: z.number().int().positive(),
})
type Target = z.infer<typeof target>

// Validate the target belongs to `propertyId` (no cross-property injection),
// then return the scope id column + value for the maintenance insert.
async function resolveTargetScope(
  db: Parameters<typeof resolvePropertyIdFromStructure>[0],
  propertyId: number,
  tgt: Target,
): Promise<
  | { structure_id: number }
  | { infrastructure_id: number }
  | { equipment_id: number }
> {
  const targetPropertyId =
    tgt.kind === "structure"
      ? await resolvePropertyIdFromStructure(db, tgt.id)
      : tgt.kind === "infrastructure"
        ? await resolvePropertyIdFromInfrastructure(db, tgt.id)
        : await resolvePropertyIdFromEquipment(db, tgt.id)
  if (targetPropertyId !== propertyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "target does not belong to this property",
    })
  }
  return tgt.kind === "structure"
    ? { structure_id: tgt.id }
    : tgt.kind === "infrastructure"
      ? { infrastructure_id: tgt.id }
      : { equipment_id: tgt.id }
}

// Reuses the maintenance.create insert shape: a general todo turned into a
// maintenance task is category 'maintenance', severity 'patch', status 'todo',
// recurrence 'once', due defaulting to 'not_decided' (server default), with
// added_by = the acting user.
function maintenanceValues(
  description: string,
  scope:
    | { structure_id: number }
    | { infrastructure_id: number }
    | { equipment_id: number },
  userId: number,
) {
  return {
    description,
    ...scope,
    category: "maintenance" as const,
    severity: "patch" as const,
    status: "todo" as const,
    recurrence: "once" as const,
    added_by: userId,
  }
}

export const todoRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(todosTable)
      .where(eq(todosTable.property_id, input.property_id))
      .orderBy(desc(todosTable.created_at), desc(todosTable.id))
    return rows.map(toWireTodo)
  }),

  create: propertyAdminProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        description: z.string().min(1).max(255),
        target: target.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const description = input.description.trim()
      if (input.target == null) {
        const [created] = await ctx.db
          .insert(todosTable)
          .values({
            property_id: input.property_id,
            description,
            created_by: ctx.user.id,
          })
          .returning()
        return { kind: "todo" as const, todo: toWireTodo(created) }
      }
      const scope = await resolveTargetScope(
        ctx.db,
        input.property_id,
        input.target,
      )
      await ctx.db
        .insert(maintenanceTable)
        .values(maintenanceValues(description, scope, ctx.user.id))
      return { kind: "maintenance" as const }
    }),

  update: propertyAdminProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        id: z.number().int().positive(),
        description: z.string().min(1).max(255).optional(),
        done: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolvePropertyIdFromTodo(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "todo does not belong to this property",
        })
      }
      const [updated] = await ctx.db
        .update(todosTable)
        .set({
          ...(input.description != null
            ? { description: input.description.trim() }
            : {}),
          ...(input.done != null ? { done: input.done } : {}),
        })
        .where(eq(todosTable.id, input.id))
        .returning()
      return toWireTodo(updated)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromTodo(ctx.db, input.id)
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [deleted] = await ctx.db
        .delete(todosTable)
        .where(eq(todosTable.id, input.id))
        .returning()
      return toWireTodo(deleted)
    }),

  moveToMaintenance: propertyAdminProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        id: z.number().int().positive(),
        target,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveTargetScope(
        ctx.db,
        input.property_id,
        input.target,
      )
      await ctx.db.transaction(async tx => {
        const existing = (
          await tx
            .select()
            .from(todosTable)
            .where(eq(todosTable.id, input.id))
            .limit(1)
        ).at(0)
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "todo not found" })
        }
        if (existing.property_id !== input.property_id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "todo does not belong to this property",
          })
        }
        await tx
          .insert(maintenanceTable)
          .values(maintenanceValues(existing.description, scope, ctx.user.id))
        await tx.delete(todosTable).where(eq(todosTable.id, input.id))
      })
      return { ok: true as const }
    }),
})
