import { router } from "../init.ts"
import { bookingRouter } from "./booking.ts"
import { dashboardRouter } from "./dashboard.ts"
import { devRouter } from "./dev.ts"
import { equipmentRouter } from "./equipment.ts"
import { eventRouter } from "./event.ts"
import { expenseRouter } from "./expense.ts"
import { expenseCategoryRouter } from "./expenseCategory.ts"
import { infrastructureRouter } from "./infrastructure.ts"
import { inspectionRouter } from "./inspection.ts"
import { inviteRouter } from "./invite.ts"
import { maintenanceRouter } from "./maintenance.ts"
import { parkingRouter } from "./parking.ts"
import { priorityRouter } from "./priority.ts"
import { propertyRouter } from "./property.ts"
import { propertyContactRouter } from "./propertyContact.ts"
import { propertyOwnerRouter } from "./propertyOwner.ts"
import { propertySplitPolicyRouter } from "./propertySplitPolicy.ts"
import { roomRouter } from "./room.ts"
import { settlementRouter } from "./settlement.ts"
import { stayRouter } from "./stay.ts"
import { structureRouter } from "./structure.ts"
import { userRouter } from "./user.ts"
import { userGroupRouter } from "./userGroup.ts"

export const appRouter = router({
  booking: bookingRouter,
  dashboard: dashboardRouter,
  dev: devRouter,
  equipment: equipmentRouter,
  event: eventRouter,
  expense: expenseRouter,
  expenseCategory: expenseCategoryRouter,
  infrastructure: infrastructureRouter,
  inspection: inspectionRouter,
  invite: inviteRouter,
  maintenance: maintenanceRouter,
  parking: parkingRouter,
  priority: priorityRouter,
  property: propertyRouter,
  propertyContact: propertyContactRouter,
  propertyOwner: propertyOwnerRouter,
  propertySplitPolicy: propertySplitPolicyRouter,
  room: roomRouter,
  settlement: settlementRouter,
  stay: stayRouter,
  structure: structureRouter,
  user: userRouter,
  userGroup: userGroupRouter,
})

export type AppRouter = typeof appRouter