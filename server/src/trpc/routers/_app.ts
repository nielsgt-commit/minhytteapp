import { router } from "../init.ts"
import { allowedEmailRouter } from "./allowedEmail.ts"
import { bookingRouter } from "./booking.ts"
import { dinnerRouter } from "./dinner.ts"
import { equipmentRouter } from "./equipment.ts"
import { equipmentCategoryRouter } from "./equipmentCategory.ts"
import { eventRouter } from "./event.ts"
import { expenseRouter } from "./expense.ts"
import { expenseCategoryRouter } from "./expenseCategory.ts"
import { infrastructureRouter } from "./infrastructure.ts"
import { inspectionRouter } from "./inspection.ts"
import { inventoryCategoryRouter } from "./inventoryCategory.ts"
import { inventoryItemRouter } from "./inventoryItem.ts"
import { maintenanceRouter } from "./maintenance.ts"
import { parkingRouter } from "./parking.ts"
import { priorityRouter } from "./priority.ts"
import { procedureStepRouter } from "./procedureStep.ts"
import { propertyRouter } from "./property.ts"
import { propertyContactRouter } from "./propertyContact.ts"
import { propertyOwnerRouter } from "./propertyOwner.ts"
import { propertySplitPolicyRouter } from "./propertySplitPolicy.ts"
import { roomRouter } from "./room.ts"
import { seasonRouter } from "./season.ts"
import { settlementRouter } from "./settlement.ts"
import { shoppingItemRouter } from "./shoppingItem.ts"
import { stayRouter } from "./stay.ts"
import { structureRouter } from "./structure.ts"
import { todoRouter } from "./todo.ts"
import { userRouter } from "./user.ts"
import { userGroupRouter } from "./userGroup.ts"
import { weatherRouter } from "./weather.ts"

export const appRouter = router({
  allowedEmail: allowedEmailRouter,
  booking: bookingRouter,
  dinner: dinnerRouter,
  equipment: equipmentRouter,
  equipmentCategory: equipmentCategoryRouter,
  event: eventRouter,
  expense: expenseRouter,
  expenseCategory: expenseCategoryRouter,
  infrastructure: infrastructureRouter,
  inspection: inspectionRouter,
  inventoryCategory: inventoryCategoryRouter,
  inventoryItem: inventoryItemRouter,
  maintenance: maintenanceRouter,
  parking: parkingRouter,
  priority: priorityRouter,
  procedureStep: procedureStepRouter,
  property: propertyRouter,
  propertyContact: propertyContactRouter,
  propertyOwner: propertyOwnerRouter,
  propertySplitPolicy: propertySplitPolicyRouter,
  room: roomRouter,
  season: seasonRouter,
  settlement: settlementRouter,
  shoppingItem: shoppingItemRouter,
  stay: stayRouter,
  structure: structureRouter,
  todo: todoRouter,
  user: userRouter,
  userGroup: userGroupRouter,
  weather: weatherRouter,
})

export type AppRouter = typeof appRouter
