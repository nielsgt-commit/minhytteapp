import { count, gte, ne, sum } from "drizzle-orm"
import { bookingTable } from "../../db/schema/booking.schema.ts"
import { maintenanceTable } from "../../db/schema/maintenance.schema.ts"
import { expensesTable } from "../../db/schema/settlement.schema.ts"
import { publicProcedure, router } from "../init.ts"

export const dashboardRouter = router({
  summary: publicProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10)

    const [expenses] = await ctx.db
      .select({ count: count(), total: sum(expensesTable.amount) })
      .from(expensesTable)

    const [upcomingBookings] = await ctx.db
      .select({ count: count() })
      .from(bookingTable)
      .where(gte(bookingTable.start_date, today))

    const [openMaintenance] = await ctx.db
      .select({ count: count() })
      .from(maintenanceTable)
      .where(ne(maintenanceTable.status, "done"))

    return {
      expenseCount: expenses.count,
      totalSpent: Number(expenses.total ?? 0),
      upcomingBookings: upcomingBookings.count,
      openMaintenance: openMaintenance.count,
    }
  }),
})
