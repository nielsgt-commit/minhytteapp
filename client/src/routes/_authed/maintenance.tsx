import { createFileRoute } from "@tanstack/react-router"
import { Maintenance } from "@/features/maintenance/Maintenance"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/maintenance")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trpc.maintenance.list.queryOptions()),
  component: Maintenance,
})