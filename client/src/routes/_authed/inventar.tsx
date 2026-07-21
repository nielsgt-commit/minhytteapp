import { createFileRoute } from "@tanstack/react-router"
import { GeneralInventoryPage } from "@/features/inventory"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/inventar")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    // Warm the edit dialog's location selects without blocking the list.
    void context.queryClient.prefetchQuery(
      trpc.structure.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
    void context.queryClient.prefetchQuery(
      trpc.room.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
    return context.queryClient.ensureQueryData(
      trpc.inventoryItem.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: GeneralInventoryPage,
})
