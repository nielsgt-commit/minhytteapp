import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { EquipmentPanel } from "@/features/property/equipment/EquipmentPanel"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export const Route = createFileRoute("/_authed/manageproperty/equipment")({
  loader: ({ context }) => {
    const propertyId = selectSelectedPropertyId(store.getState())
    return Promise.all([
      context.queryClient.ensureQueryData(trpc.structure.list.queryOptions()),
      propertyId == null
        ? undefined
        : context.queryClient.ensureQueryData(
            trpc.equipment.listForProperty.queryOptions({
              property_id: propertyId,
            }),
          ),
    ])
  },
  component: EquipmentRoute,
})

function EquipmentRoute() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId)
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const property =
    propertyId != null ? properties.find(p => p.id === propertyId) : undefined
  if (!property) return null
  return <EquipmentPanel propertyId={property.id} propertyName={property.name} />
}
