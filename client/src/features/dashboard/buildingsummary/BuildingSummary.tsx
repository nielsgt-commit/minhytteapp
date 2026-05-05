import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export default function BuildingSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: buildings } = useSuspenseQuery(
    trpc.building.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const roomCountByBuilding = new Map<number, number>()
  for (const r of rooms) {
    roomCountByBuilding.set(
      r.building_id,
      (roomCountByBuilding.get(r.building_id) ?? 0) + 1,
    )
  }

  return (
    <>
      <h4>Buildings ({buildings.length})</h4>
      {buildings.length === 0 ? (
        <p>No buildings yet.</p>
      ) : (
        <ul>
          {buildings.map(b => {
            const count = roomCountByBuilding.get(b.id) ?? 0
            return (
              <li key={b.id}>
                {b.name} – {count} room{count === 1 ? "" : "s"}
              </li>
            )
          })}
        </ul>
      )}
      <Link to="/manageproperty">Manage buildings</Link>
    </>
  )
}