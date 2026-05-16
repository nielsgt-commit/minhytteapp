import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { InfrastructurePanel } from "@/features/property/infrastructure/InfrastructurePanel"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export const Route = createFileRoute("/_authed/manageproperty/infrastructure")({
  loader: ({ context }) => {
    const propertyId = selectSelectedPropertyId(store.getState())
    if (propertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.infrastructure.listForProperty.queryOptions({ property_id: propertyId }),
    )
  },
  component: InfrastructureRoute,
})

function InfrastructureRoute() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId)
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const property =
    propertyId != null ? properties.find(p => p.id === propertyId) : undefined
  if (!property) return null
  return <InfrastructurePanel propertyId={property.id} propertyName={property.name} />
}
