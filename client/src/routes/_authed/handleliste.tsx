import { createFileRoute } from "@tanstack/react-router"
import { ShoppingPage } from "@/features/shoppinglist/ShoppingPage"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/handleliste")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    // Warm the inventory toggle's data without blocking the default view.
    void context.queryClient.prefetchQuery(
      trpc.inventoryItem.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
    return context.queryClient.ensureQueryData(
      trpc.shoppingItem.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: ShoppingPage,
})
