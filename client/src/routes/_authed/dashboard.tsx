import { createFileRoute } from "@tanstack/react-router"
import { Dashboard } from "@/features/dashboard/Dashboard"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/dashboard")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trpc.dashboard.summary.queryOptions()),
  component: Dashboard,
})