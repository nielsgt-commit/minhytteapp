import { createFileRoute } from "@tanstack/react-router"
import { Settlement } from "@/features/settlement/Settlement"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/oppgjor")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.settlement.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: Settlement,
})
