import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import AtPropertyNow from "./userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "./availableparking/AvailableParking.tsx"

type RoomBeds = {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

function totalBeds(r: RoomBeds) {
  return (
    r.beds_sm +
    r.beds_lg +
    r.beds_double * 2 +
    r.beds_kid +
    r.mattresses +
    r.travel_cot
  )
}

export function CapacitySummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )


  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"






  return (
    <>
      <h4> At {propertyName} now: </h4>
      <AtPropertyNow />

      <AvailableParking />
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "1rem", listStyle: "none", padding: 0 }}>
        {Array.from(
          rooms.reduce((acc, r) => {
            const prev = acc.get(r.building_id)
            acc.set(r.building_id, {
              name: r.building_name ?? `Building #${String(r.building_id)}`,
              beds: (prev?.beds ?? 0) + totalBeds(r),
            })
            return acc
          }, new Map<number, { name: string; beds: number }>()),
        ).map(([id, b]) => (
          <li key={id}>
            {b.name} ({b.beds} beds)
          </li>
        ))}
      </ul>
    </>
  )
}
