import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Divider, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import styles from "./CapacitySummary.module.css"
import { AtPropertyNow } from "./userscheckedin/AtPropertyNow.tsx"
import { AvailableParking } from "./availableparking/AvailableParking.tsx"
import { RoomAvailabilityIndicator } from "./roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { NowWeather } from "../weather/NowWeather.tsx"
import { useTRPC } from "@/trpc/trpc.ts"

// Fetches its own rooms so a slow/failing rooms query only affects this card.
function AvailableBeds() {
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )
  return <RoomAvailabilityIndicator rooms={rooms} />
}

export function CapacitySummary() {
  const { t } = useTranslation("dashboard")

  return (
    <div className={styles.row}>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="xs">
                {t("Weather today")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <NowWeather />
              </QueryBoundary>
            </div>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="xs">
                {t("Checked in")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <AtPropertyNow />
              </QueryBoundary>
            </div>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="xs">
                {t("Parking")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <AvailableParking />
              </QueryBoundary>
            </div>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="xs">
                {t("Available beds")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <AvailableBeds />
              </QueryBoundary>
            </div>
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}
