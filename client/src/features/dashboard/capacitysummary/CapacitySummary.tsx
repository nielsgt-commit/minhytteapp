import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import CheckIn from "@/components/core/header/CheckIn.tsx"
import AtPropertyNow from "./userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "./availableparking/AvailableParking.tsx"
import RoomAvailabilityIndicator from "./roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { Card, Divider, Heading } from "@digdir/designsystemet-react"

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
    <Card asChild>
      <section>
        <Card.Block>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "1.5rem",
                alignSelf: "stretch",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <Heading level={6} size="medium">{propertyName} now</Heading>
                <AtPropertyNow />
              </div>
              <AvailableParking />
            </div>
            <Divider style={{ alignSelf: "stretch" }} />
            <RoomAvailabilityIndicator rooms={rooms} />
          </div>
        </Card.Block>
      </section>
    </Card>
  )
}
