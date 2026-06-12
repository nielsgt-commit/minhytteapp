import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Paragraph, Tabs } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import styles from "./Dashboard.module.css"
import { useTRPC } from "@/trpc/trpc"
import { PlannedAvailabilitySummary } from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import { PlannedMaintenanceSummary } from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { AtPropertyNow } from "@/features/dashboard/capacitysummary/userscheckedin/AtPropertyNow.tsx"
import { AvailableParking } from "@/features/dashboard/capacitysummary/availableparking/AvailableParking.tsx"
import { RoomAvailabilityIndicator } from "@/features/dashboard/capacitysummary/roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { NowWeather } from "@/features/dashboard/weather/NowWeather.tsx"
import { MyPlannedStay } from "@/features/dashboard/myplannedstay/MyPlannedStay.tsx"
// import { SummerSummary } from "@/features/dashboard/summersummary/SummerSummary.tsx"
import { Temporal } from "temporal-polyfill"
import { startOfSunday } from "@/utils/dateUtils"

type Tab = "now" | "week" | "summer" | "year"

export function MobileTabs({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const [tab, setTab] = useState<Tab>("now")

  return (
    <Tabs
      className={styles.mobileTabs}
      value={tab}
      onChange={v => {
        setTab(v as Tab)
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="now" aria-label={t("Now")}>
          <Paragraph>{t("Now")} </Paragraph>
        </Tabs.Tab>
        <Tabs.Tab value="week" aria-label={t("This week")}>
          <Paragraph>{t("This week")}</Paragraph>
        </Tabs.Tab>
        {/* Summer tab unmounted for now */}
        {/* <Tabs.Tab value="summer" aria-label={t("Summer")}>
          <Paragraph>{t("Summer")}</Paragraph>
        </Tabs.Tab> */}
        <Tabs.Tab value="year" aria-label={t("This year")}>
          <Paragraph>{t("This year")}</Paragraph>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value={tab}>
        {tab === "now" && (
          <QueryBoundary>
            <MobileNowPanel propertyId={propertyId} />
          </QueryBoundary>
        )}
        {tab === "week" && (
          <QueryBoundary>
            <MobileWeekPanel />
          </QueryBoundary>
        )}
        {/* {tab === "summer" && (
          <QueryBoundary>
            <MobileSummerPanel propertyId={propertyId} />
          </QueryBoundary>
        )} */}
        {tab === "year" && (
          <QueryBoundary>
            <MobileYearPanel />
          </QueryBoundary>
        )}
      </Tabs.Panel>
    </Tabs>
  )
}

// function MobileSummerPanel({ propertyId }: { propertyId: number }) {
//   return (
//     <div className={styles.stackedPanels}>
//       <SummerSummary propertyId={propertyId} />
//     </div>
//   )
// }

function MobileNowPanel({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  return (
    <div className={styles.stackedPanels}>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("Weather today")}
            </Heading>
            <QueryBoundary fallback={<CardSkeleton lines={1} />}>
              <NowWeather />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("At {{propertyName}} now", { propertyName })}
            </Heading>
            <QueryBoundary fallback={<CardSkeleton lines={1} />}>
              <AtPropertyNow />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("Available parking")}
            </Heading>
            <QueryBoundary fallback={<CardSkeleton lines={1} />}>
              <AvailableParking />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("Available beds")}
            </Heading>
            <RoomAvailabilityIndicator rooms={rooms} />
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}

function MobileYearPanel() {
  const { t } = useTranslation("dashboard")

  return (
    <div className={styles.stackedPanels}>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("My planned stays")}
            </Heading>
            <QueryBoundary>
              <MyPlannedStay />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <QueryBoundary>
              <PlannedMaintenanceSummary mode="rest" />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}

function MobileWeekPanel() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfSunday(Temporal.Now.plainDateISO()),
  )

  return (
    <div className={styles.stackedPanels}>
      <Card asChild>
        <section>
          <Card.Block>
            <QueryBoundary>
              <PlannedAvailabilitySummary
                weekStart={weekStart}
                onWeekStartChange={setWeekStart}
              />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <QueryBoundary>
              <PlannedMaintenanceSummary
                mode="this-week"
                weekStart={weekStart}
              />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}
