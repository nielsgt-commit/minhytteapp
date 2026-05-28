import { createFileRoute } from "@tanstack/react-router"
import { Dashboard } from "@/features/dashboard/Dashboard"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/dashboard")({
  loader: ({ context }) => {
    const propertyList = context.queryClient.ensureQueryData(
      trpc.property.mine.queryOptions(),
    )
    if (context.selectedPropertyId == null) return propertyList
    return Promise.all([
      propertyList,
      context.queryClient.ensureQueryData(
        trpc.user.listForProperty.queryOptions({
          property_id: context.selectedPropertyId,
        }),
      ),
    ])
  },
  component: Dashboard,
})
