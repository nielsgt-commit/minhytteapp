import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Divider, Heading } from "@digdir/designsystemet-react"
import styles from "./CapacitySummary.module.css"
import AtPropertyNow from "./userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "./availableparking/AvailableParking.tsx"
import RoomAvailabilityIndicator from "./roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

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
          <div className={styles.stack}>
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <Heading level={6} size="medium">{propertyName} now</Heading>
                <AtPropertyNow />
              </div>
              <AvailableParking />
            </div>
            <Divider className={styles.divider} />
            <RoomAvailabilityIndicator rooms={rooms} />
          </div>
        </Card.Block>
      </section>
    </Card>
  )
}
