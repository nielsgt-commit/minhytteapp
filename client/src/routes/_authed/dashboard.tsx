import { createFileRoute } from "@tanstack/react-router"
import { Dashboard } from "@/features/dashboard/Dashboard"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/dashboard")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        trpc.dashboard.summary.queryOptions(),
      ),
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.property.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.building.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.room.list.queryOptions()),
    ]),
  component: Dashboard,
})
