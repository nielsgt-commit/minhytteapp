import { createFileRoute } from "@tanstack/react-router"
import { ListPropertyStructures } from "@/features/property/testform/ListPropertyStructures"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty/structures")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return Promise.all([
      context.queryClient.ensureQueryData(
        trpc.structure.listForProperty.queryOptions({
          property_id: selectedPropertyId,
        }),
      ),
      context.queryClient.ensureQueryData(
        trpc.room.listForProperty.queryOptions({
          property_id: selectedPropertyId,
        }),
      ),
    ])
  },
  component: ListPropertyStructures,
})
