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
      <h1>Planned Maintenance</h1>
      {buildingsWithItems.length === 0 ? (
        <p>No planned maintenance.</p>
      ) : (
        <ul>
          {buildingsWithItems.map(b => {
            const bucket = itemsByBuilding.get(b.id) ?? []
            return (
              <li key={b.id}>
                {b.name}
                <ul>
                  {bucket.map(it => (
                    <li key={it.id}>
                      {it.description} ({it.status})
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </>

  )
}