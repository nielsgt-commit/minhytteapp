import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { bookingTable } from "../../db/schema/booking.schema.ts"
import { usersTable } from "../../db/schema/users.schema.ts"
import { protectedProcedure, publicProcedure, router } from "../init.ts"

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

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
    .input(
      z
        .object({
          property_id: z.number().int().positive(),
          booker_id: z.number().int().positive(),
          start_date: dateString,
          end_date: dateString,
        })
        .refine((v) => v.start_date <= v.end_date, {
          message: "start_date must be on or before end_date",
          path: ["end_date"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(bookingTable)
        .values(input)
        .returning()
      return created
    }),
})