import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { BuildingCard } from "@/features/maintenance/BuildingCard.tsx"
import { BuildingFilter } from "@/features/maintenance/BuildingFilter.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function BuildingStats() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: buildings } = useSuspenseQuery(
    trpc.building.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  )

  const propertyBuildings = buildings

  if (propertyBuildings.length === 0) {
    return <p>No buildings for the selected property. Go to Manage Property</p>
  }

  const toggle = (id: number) => {
    setHiddenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <BuildingFilter
        buildings={propertyBuildings}
        hiddenIds={hiddenIds}
        onToggle={toggle}
      />
      {propertyBuildings
        .filter(b => !hiddenIds.has(b.id))
        .map(b => (
          <BuildingCard key={b.id} buildingId={b.id} buildingName={b.name} />
        ))}
    </>
  )
}