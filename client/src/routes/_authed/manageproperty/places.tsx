import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { PlacesPanel } from "@/features/property/places/PlacesPanel"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export const Route = createFileRoute("/_authed/manageproperty/places")({
  loader: ({ context }) => {
    const propertyId = selectSelectedPropertyId(store.getState())
    if (propertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.place.listForProperty.queryOptions({ property_id: propertyId }),
    )
  },
  component: PlacesRoute,
})

function PlacesRoute() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId)
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const property =
    propertyId != null ? properties.find(p => p.id === propertyId) : undefined
  if (!property) return null
  return <PlacesPanel propertyId={property.id} propertyName={property.name} />
}
