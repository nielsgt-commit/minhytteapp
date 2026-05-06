import { createFileRoute } from "@tanstack/react-router"
import { Calendar } from "@/features/calendar/Calendar"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/calendar")({
  loader: ({ context }) => {
    const tasks: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(trpc.user.me.queryOptions()),
    ]
    const propertyId = selectSelectedPropertyId(store.getState())
    if (propertyId != null) {
      tasks.push(
        context.queryClient.ensureQueryData(
          trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
        ),
      )
    }
    return Promise.all(tasks)
  },
  component: Calendar,
})