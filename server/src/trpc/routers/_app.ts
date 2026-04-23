import { router } from "../init.ts"
import { bookingRouter } from "./booking.ts"
import { buildingRouter } from "./building.ts"
import { dashboardRouter } from "./dashboard.ts"
import { expenseRouter } from "./expense.ts"
import { familyRouter } from "./family.ts"
import { maintenanceRouter } from "./maintenance.ts"
import { propertyRouter } from "./property.ts"
import { propertyOwnerRouter } from "./propertyOwner.ts"
import { roomRouter } from "./room.ts"
import { settlementRouter } from "./settlement.ts"
import { userRouter } from "./user.ts"

export const appRouter = router({
  booking: bookingRouter,
  building: buildingRouter,
  dashboard: dashboardRouter,
  expense: expenseRouter,
  family: familyRouter,
  maintenance: maintenanceRouter,
  property: propertyRouter,
  propertyOwner: propertyOwnerRouter,
  room: roomRouter,
  settlement: settlementRouter,
  user: userRouter,
})

export type AppRouter = typeof appRouter
