import { router } from "../init.ts"
import { bookingRouter } from "./booking.ts"
import { dashboardRouter } from "./dashboard.ts"
import { expenseRouter } from "./expense.ts"
import { maintenanceRouter } from "./maintenance.ts"
import { settlementRouter } from "./settlement.ts"

export const appRouter = router({
  booking: bookingRouter,
  dashboard: dashboardRouter,
  expense: expenseRouter,
  maintenance: maintenanceRouter,
  settlement: settlementRouter,
})

export type AppRouter = typeof appRouter