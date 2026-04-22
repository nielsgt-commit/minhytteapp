import { createFileRoute } from "@tanstack/react-router"
import { Calendar } from "@/features/calendar/Calendar"
import { bookingQueries } from "@/features/calendar/api/queries"

export const Route = createFileRoute("/_authed/calendar")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(bookingQueries.list()),
  component: Calendar,
})
