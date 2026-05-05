import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export default function PlannedMaintenanceSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: buildings } = useSuspenseQuery(
    trpc.building.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: items } = useSuspenseQuery(
    trpc.maintenance.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const pending = items.filter(
    i => i.status === "todo" || i.status === "doing",
  )
  const itemsByBuilding = new Map<number, typeof pending>()
  for (const it of pending) {
    if (it.building_id == null) continue
    const bucket = itemsByBuilding.get(it.building_id) ?? []
    bucket.push(it)
    itemsByBuilding.set(it.building_id, bucket)
  }

  const buildingsWithItems = buildings.filter(b => itemsByBuilding.has(b.id))

  return (
    <>
      <h4>Planned Maintenance</h4>
      {buildingsWithItems.length === 0 ? (
        <p>No planned maintenance.</p>
      ) : (
        <ul style={{ display: "flex", flexWrap: "wrap", gap: "1rem", listStyle: "none", padding: 0 }}>
          {buildingsWithItems.map(b => {
            const bucket = itemsByBuilding.get(b.id) ?? []
            return (
              <li key={b.id}>
                {b.name} ({bucket.length} open)
              </li>
            )
          })}
        </ul>
      )}
    </>

  )
}