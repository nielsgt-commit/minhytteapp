import { router } from "../init.ts"
import { bookingRouter } from "./booking.ts"
import { buildingRouter } from "./building.ts"
import { dashboardRouter } from "./dashboard.ts"
import { devRouter } from "./dev.ts"
import { equipmentRouter } from "./equipment.ts"
import { expenseRouter } from "./expense.ts"
import { inviteRouter } from "./invite.ts"
import { maintenanceRouter } from "./maintenance.ts"
import { parkingRouter } from "./parking.ts"
import { placeRouter } from "./place.ts"
import { priorityRouter } from "./priority.ts"
import { propertyRouter } from "./property.ts"
import { propertyOwnerRouter } from "./propertyOwner.ts"
import { roomRouter } from "./room.ts"
import { settlementRouter } from "./settlement.ts"
import { stayRouter } from "./stay.ts"
import { userRouter } from "./user.ts"
import { userGroupRouter } from "./userGroup.ts"

export const appRouter = router({
  booking: bookingRouter,
  building: buildingRouter,
  dashboard: dashboardRouter,
  dev: devRouter,
  equipment: equipmentRouter,
  expense: expenseRouter,
  invite: inviteRouter,
  maintenance: maintenanceRouter,
  parking: parkingRouter,
  place: placeRouter,
  priority: priorityRouter,
  property: propertyRouter,
  propertyOwner: propertyOwnerRouter,
  room: roomRouter,
  settlement: settlementRouter,
  stay: stayRouter,
  user: userRouter,
  userGroup: userGroupRouter,
})

export type AppRouter = typeof appRouter