import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import CheckIn from "@/components/core/header/CheckIn.tsx"
import AtPropertyNow from "./userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "./availableparking/AvailableParking.tsx"
import RoomAvailabilityIndicator from "./roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { Heading } from "@digdir/designsystemet-react"

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
      <Heading level={6}> At {propertyName} now: </Heading>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <AtPropertyNow />
        <AvailableParking />
      </div>
      <RoomAvailabilityIndicator rooms={rooms} />
    </>
  )
}
