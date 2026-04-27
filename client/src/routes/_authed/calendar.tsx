import { createFileRoute } from "@tanstack/react-router"
import { Calendar } from "@/features/calendar/Calendar"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/calendar")({
  loader: ({ context }) => {
    if (selectSelectedPropertyId(store.getState()) == null) return
    return context.queryClient.ensureQueryData(trpc.booking.list.queryOptions())
  },
  component: Calendar,
})