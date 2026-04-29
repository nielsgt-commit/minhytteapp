import { TRPCError } from "@trpc/server"
import { and, desc, eq, isNull, or, sql } from "drizzle-orm"
import { z } from "zod"
import { eventTable } from "../../db/schema/event.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, router } from "../init.ts"

const propertyInput = z.object({ property_id: z.number().int().positive() })

const activeFilter = (propertyId: number) =>
  and(
    eq(eventTable.property_id, propertyId),
    or(
      isNull(eventTable.expires_on),
      sql`${eventTable.expires_on} >= CURRENT_DATE`,
    ),
  )

export const eventRouter = router({
  list: protectedProcedure
    .input(propertyInput)
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: eventTable.id,
          body: eventTable.body,
          expires_on: eventTable.expires_on,
          created_at: eventTable.created_at,
          author_id: eventTable.author_id,
          author_name: usersTable.name,
        })
        .from(eventTable)
        .innerJoin(usersTable, eq(usersTable.id, eventTable.author_id))
        .where(activeFilter(input.property_id))
        .orderBy(desc(eventTable.created_at))
    }),

  create: protectedProcedure
    .input(
      propertyInput.extend({
        body: z.string().trim().min(1).max(280),
        expires_on: z.iso.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(eventTable)
        .values({
          property_id: input.property_id,
          author_id: ctx.user.id,
          body: input.body,
          expires_on: input.expires_on ?? null,
        })
        .returning()
      return created
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ author_id: eventTable.author_id })
        .from(eventTable)
        .where(eq(eventTable.id, input.id))
        .limit(1)
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "event not found" })
      }
      if (existing.author_id !== ctx.user.id && !ctx.user.is_admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "only the author or an admin can delete this event",
        })
      }
      const [deleted] = await ctx.db
        .delete(eventTable)
        .where(eq(eventTable.id, input.id))
        .returning({ id: eventTable.id })
      return deleted
    }),
})