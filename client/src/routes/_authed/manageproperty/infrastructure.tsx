import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { InfrastructurePanel } from "@/features/property/infrastructure/InfrastructurePanel"
import { trpc } from "@/trpc/client"
import { useTRPC } from "@/trpc/trpc"

export const Route = createFileRoute("/_authed/manageproperty/infrastructure")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.infrastructure.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: InfrastructureRoute,
})

function InfrastructureRoute() {
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const property =
    propertyId != null ? properties.find(p => p.id === propertyId) : undefined
  if (!property) return null
  return <InfrastructurePanel propertyId={property.id} propertyName={property.name} />
}
