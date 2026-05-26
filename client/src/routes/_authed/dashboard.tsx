import { createFileRoute } from "@tanstack/react-router"
import { Dashboard } from "@/features/dashboard/Dashboard"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/dashboard")({
  loader: ({ context }) => {
    const propertyList = context.queryClient.ensureQueryData(
      trpc.property.list.queryOptions(),
    )
    if (context.selectedPropertyId == null) return propertyList
    return Promise.all([
      propertyList,
      context.queryClient.ensureQueryData(
        trpc.dashboard.summary.queryOptions(),
      ),
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
    ])
  },
  component: Dashboard,
})
