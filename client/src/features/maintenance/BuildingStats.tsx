import { useSuspenseQuery } from "@tanstack/react-query"
import { BuildingCard } from "@/features/maintenance/BuildingCard.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function BuildingStats() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )

  const propertyBuildings =
    selectedPropertyId != null
      ? buildings.filter(b => b.property_id === selectedPropertyId)
      : []

  if (propertyBuildings.length === 0) {
    return <p>No buildings for the selected property. Go to Manage Property</p>
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {propertyBuildings.map(b => (
        <BuildingCard key={b.id} buildingId={b.id} buildingName={b.name} />
      ))}
    </div>
  )
}