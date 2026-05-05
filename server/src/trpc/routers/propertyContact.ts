import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { propertyContactsTable } from "../../db/schema/property.schema.ts"
import { propertyAdminProcedure, router } from "../init.ts"

const contactFields = {
  name: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(64).nullable().optional(),
  email: z.string().trim().max(255).nullable().optional(),
  info: z.string().trim().max(1024).nullable().optional(),
}

export const propertyContactRouter = router({
  listForProperty: propertyAdminProcedure.query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: propertyContactsTable.id,
        property_id: propertyContactsTable.property_id,
        name: propertyContactsTable.name,
        phone: propertyContactsTable.phone,
        email: propertyContactsTable.email,
        info: propertyContactsTable.info,
      })
      .from(propertyContactsTable)
      .where(eq(propertyContactsTable.property_id, input.property_id))
      .orderBy(asc(propertyContactsTable.name))
  }),

  create: propertyAdminProcedure
    .input(z.object(contactFields))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(propertyContactsTable)
        .values({
          property_id: input.property_id,
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          info: input.info ?? null,
        })
        .returning()
      return created
    }),

  update: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive(), ...contactFields }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(propertyContactsTable)
        .set({
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          info: input.info ?? null,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(propertyContactsTable.id, input.id),
            eq(propertyContactsTable.property_id, input.property_id),
          ),
        )
        .returning()
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return updated
    }),

  delete: propertyAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(propertyContactsTable)
        .where(
          and(
            eq(propertyContactsTable.id, input.id),
            eq(propertyContactsTable.property_id, input.property_id),
          ),
        )
        .returning()
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return deleted
    }),
})