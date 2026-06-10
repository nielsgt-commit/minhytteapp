import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./CapacitySummary.module.css"
import AtPropertyNow from "./userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "./availableparking/AvailableParking.tsx"
import RoomAvailabilityIndicator from "./roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import NowWeather from "../weather/NowWeather.tsx"
import { useTRPC } from "@/trpc/trpc.ts"

export function CapacitySummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  return (
    <div className={styles.row}>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="md">
                {t("Weather now")}
              </Heading>
              <NowWeather />
            </div>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="md">
                {t("At property now")}
              </Heading>
              <AtPropertyNow />
            </div>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="md">
                {t("Available parking")}
              </Heading>
              <AvailableParking />
            </div>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <div className={styles.cardStack}>
              <Heading level={6} data-size="md">
                {t("Available beds")}
              </Heading>
              <RoomAvailabilityIndicator rooms={rooms} />
            </div>
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}
