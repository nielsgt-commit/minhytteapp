import { createFileRoute } from "@tanstack/react-router"
import { Calendar } from "@/features/calendar/Calendar"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/calendar")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trpc.booking.list.queryOptions()),
  component: Calendar,
})