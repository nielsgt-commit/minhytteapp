import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { maintenanceTable } from "../../db/schema/maintenance.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const maintenanceFields = {
  description: z.string().min(1),
  summary: z.string().optional(),
  added_by: z.number().int().positive(),
  assigned_to_id: z.number().int().positive().optional(),
  building_id: z.number().int().positive().optional(),
  place_id: z.number().int().positive().optional(),
  category: z.enum([
    "plumbing",
    "electrical",
    "grounds",
    "exterior",
    "interior",
    "other",
  ]),
  severity: z.enum(["major", "minor", "patch"]),
  status: z.enum(["todo", "doing", "done"]),
  recurrence: z.enum(["ephemeral", "recurring"]),
  recurrence_interval_days: z.number().int().positive().optional(),
}

const locationXor = {
  check: (v: { building_id?: number; place_id?: number }) =>
    (v.building_id != null) !== (v.place_id != null),
  error: "exactly one of building_id or place_id must be set",
  path: ["place_id"] as const,
}

const recurrenceXor = {
  check: (v: { recurrence: string; recurrence_interval_days?: number }) =>
    (v.recurrence === "recurring") === (v.recurrence_interval_days != null),
  error:
    "recurrence_interval_days is required iff recurrence is 'recurring'",
  path: ["recurrence_interval_days"] as const,
}

const createInput = z
  .object(maintenanceFields)
  .refine(locationXor.check, {
    error: locationXor.error,
    path: [...locationXor.path],
  })
  .refine(recurrenceXor.check, {
    error: recurrenceXor.error,
    path: [...recurrenceXor.path],
  })

const updateInput = z
  .object({ id: z.number().int().positive(), ...maintenanceFields })
  .refine(locationXor.check, {
    error: locationXor.error,
    path: [...locationXor.path],
  })
  .refine(recurrenceXor.check, {
    error: recurrenceXor.error,
    path: [...recurrenceXor.path],
  })

export const maintenanceRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(maintenanceTable)
      .orderBy(asc(maintenanceTable.created_at))
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