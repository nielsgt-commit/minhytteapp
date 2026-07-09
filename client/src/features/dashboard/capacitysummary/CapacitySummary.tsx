import { Card, Divider, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import styles from "./CapacitySummary.module.css"
import { AtPropertyNow } from "./userscheckedin/AtPropertyNow.tsx"
import { AvailableParking } from "./availableparking/AvailableParking.tsx"
import { AvailableBedsToday } from "./roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { NowWeather } from "../weather/NowWeather.tsx"
import { DinnerToday } from "../dinner/DinnerToday.tsx"

export function CapacitySummary() {
  const { t } = useTranslation("dashboard")

  return (
    <div className={styles.row}>
      <div className={styles.stackedCell}>
        <Card asChild>
          <section>
            <Card.Block>
              <div className={styles.cardStack}>
                <Heading level={6} data-size="xs">
                  {t("Weather")}
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
                  {t("Dinner")}
                </Heading>
                <Divider className={styles.divider} />
                <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                  <DinnerToday />
                </QueryBoundary>
              </div>
            </Card.Block>
          </section>
        </Card>
      </div>
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
                <AvailableBedsToday />
              </QueryBoundary>
            </div>
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}
