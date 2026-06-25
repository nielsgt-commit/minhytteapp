import { createFileRoute } from "@tanstack/react-router"
import { ShoppingList } from "@/features/shoppinglist/ShoppingList"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/handleliste")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.shoppingItem.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: ShoppingList,
})
