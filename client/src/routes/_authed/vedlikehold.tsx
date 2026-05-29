import { createFileRoute } from "@tanstack/react-router"
import { Maintenance } from "@/features/maintenance/Maintenance"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/vedlikehold")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.maintenance.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: Maintenance,
})
