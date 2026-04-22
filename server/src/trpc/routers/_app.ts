import { router } from "../init.ts"
import { bookingRouter } from "./booking.ts"

export const appRouter = router({
  booking: bookingRouter,
})

export type AppRouter = typeof appRouter