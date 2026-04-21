import { createFileRoute } from "@tanstack/react-router"
import { Maintenance } from "@/features/maintenance/Maintenance"
import { maintenanceQueries } from "@/features/maintenance/api/queries"

export const Route = createFileRoute("/_authed/maintenance")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(maintenanceQueries.list()),
  component: Maintenance,
})
