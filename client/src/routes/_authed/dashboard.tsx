import { createFileRoute } from "@tanstack/react-router"
import { Dashboard } from "@/features/dashboard/Dashboard"
import { dashboardQueries } from "@/features/dashboard/api/queries"

export const Route = createFileRoute("/_authed/dashboard")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardQueries.summary()),
  component: Dashboard,
})
