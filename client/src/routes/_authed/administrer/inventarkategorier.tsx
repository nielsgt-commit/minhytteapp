import { createFileRoute } from "@tanstack/react-router"
import { ManageInventoryCategories } from "@/features/inventory/ManageInventoryCategories"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/administrer/inventarkategorier")(
  {
    loader: ({ context }) => {
      const { selectedPropertyId } = context
      if (selectedPropertyId == null) return
      return context.queryClient.ensureQueryData(
        trpc.inventoryCategory.list.queryOptions({
          property_id: selectedPropertyId,
        }),
      )
    },
    component: ManageInventoryCategories,
  },
)
