import { createFileRoute } from "@tanstack/react-router"
import { Maintenance } from "@/features/maintenance/Maintenance"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/maintenance")({
  loader: ({ context }) => {
    const propertyId = selectSelectedPropertyId(store.getState())
    if (propertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.maintenance.listForProperty.queryOptions({ property_id: propertyId }),
    )
  },
  component: Maintenance,
})