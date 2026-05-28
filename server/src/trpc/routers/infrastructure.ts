import { asc, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { infrastructureTable } from "../../db/schema/property.schema.ts"
import {
  assertPropertyMember,
  propertyAdminProcedure,
  protectedProcedure,
  router,
} from "../init.ts"
import { resolvePropertyIdFromInfrastructure } from "../util/propertyAccess.ts"

const infrastructureFields = {
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().max(255).nullable().optional(),
  property_id: z.number().int().positive(),
  since_year: z.number().int().min(1500).max(2100).nullable().optional(),
}

const createInput = z.object(infrastructureFields)

const updateInput = z.object({
  id: z.number().int().positive(),
  ...infrastructureFields,
})

export const infrastructureRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    return ctx.db
      .select()
      .from(infrastructureTable)
      .where(eq(infrastructureTable.property_id, input.property_id))
      .orderBy(asc(infrastructureTable.id))
  }),

  create: propertyAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(infrastructureTable)
        .values(input)
        .returning()
      return created
    }),

  update: propertyAdminProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const existingPropertyId = await resolvePropertyIdFromInfrastructure(
        ctx.db,
        input.id,
      )
      if (existingPropertyId !== input.property_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "cannot reassign infrastructure to another property",
        })
      }
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(infrastructureTable)
        .set(rest)
        .where(eq(infrastructureTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const propertyId = await resolvePropertyIdFromInfrastructure(
        ctx.db,
        input.id,
      )
      await assertPropertyMember(ctx.db, ctx.user, propertyId)
      const [deleted] = await ctx.db
        .delete(infrastructureTable)
        .where(eq(infrastructureTable.id, input.id))
        .returning()
      return deleted
    }),
})
