import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { bookingTable } from "../../db/schema/booking.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  error: "expected YYYY-MM-DD",
})

const bookingFields = {
  property_id: z.number().int().positive(),
  booker_id: z.number().int().positive(),
  start_date: dateString,
  end_date: dateString,
}

const dateOrder = {
  check: (v: { start_date: string; end_date: string }) =>
    v.start_date <= v.end_date,
  error: "start_date must be on or before end_date",
  path: ["end_date"] as const,
}

const createInput = z.object(bookingFields).refine(dateOrder.check, {
  error: dateOrder.error,
  path: [...dateOrder.path],
})

const updateInput = z
  .object({ id: z.number().int().positive(), ...bookingFields })
  .refine(dateOrder.check, {
    error: dateOrder.error,
    path: [...dateOrder.path],
  })

export const bookingRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: bookingTable.id,
        property_id: bookingTable.property_id,
        booker_id: bookingTable.booker_id,
        booker_name: usersTable.name,
        start_date: bookingTable.start_date,
        end_date: bookingTable.end_date,
      })
      .from(bookingTable)
      .leftJoin(usersTable, eq(usersTable.id, bookingTable.booker_id))
      .orderBy(asc(bookingTable.start_date))
    return rows
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(bookingTable)
        .values(input)
        .returning()
      return created
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      const [updated] = await ctx.db
        .update(bookingTable)
        .set(rest)
        .where(eq(bookingTable.id, id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(bookingTable)
        .where(eq(bookingTable.id, input.id))
        .returning()
      return deleted
    }),
})