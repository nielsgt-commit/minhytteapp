import { Suspense, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Paragraph, Tabs } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./Dashboard.module.css"
import { useTRPC } from "@/trpc/trpc"
import PlannedAvailabilitySummary from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import PlannedMaintenanceSummary from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import AtPropertyNow from "@/features/dashboard/capacitysummary/userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "@/features/dashboard/capacitysummary/availableparking/AvailableParking.tsx"
import RoomAvailabilityIndicator from "@/features/dashboard/capacitysummary/roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import NowWeather from "@/features/dashboard/weather/NowWeather.tsx"
import { MyPlannedStay } from "@/features/dashboard/myplannedstay/MyPlannedStay.tsx"
import { startOfSunday } from "@/utils/dateUtils"

export default function MobileTabs({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const [tab, setTab] = useState<"now" | "week" | "summer">("now")

  return (
    <Tabs
      className={styles.mobileTabs}
      value={tab}
      onChange={v => {
        setTab(v as "now" | "week" | "summer")
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="now" aria-label={t("Now")}>
          <Paragraph>{t("Now")} </Paragraph>
        </Tabs.Tab>
        <Tabs.Tab value="week" aria-label={t("This week")}>
          <Paragraph>{t("This week")}</Paragraph>
        </Tabs.Tab>
        <Tabs.Tab value="summer" aria-label={t("This year")}>
          <Paragraph>{t("This year")}</Paragraph>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value={tab}>
        {tab === "now" && (
          <Suspense fallback={<p>{t("Loading…")}</p>}>
            <MobileNowPanel propertyId={propertyId} />
          </Suspense>
        )}
        {tab === "week" && (
          <Suspense fallback={<p>{t("Loading…")}</p>}>
            <MobileWeekPanel />
          </Suspense>
        )}
        {tab === "summer" && (
          <Suspense fallback={<p>{t("Loading…")}</p>}>
            <MobileYearPanel />
          </Suspense>
        )}
      </Tabs.Panel>
    </Tabs>
  )
}

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
              {t("Weather now")}
            </Heading>
            <NowWeather />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("At {{propertyName}} now", { propertyName })}
            </Heading>
            <AtPropertyNow />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("Available parking")}
            </Heading>
            <AvailableParking />
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
            <MyPlannedStay />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <PlannedMaintenanceSummary mode="rest" />
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}

function MobileWeekPanel() {
  const [weekStart, setWeekStart] = useState(() => startOfSunday(new Date()))

  return (
    <div className={styles.stackedPanels}>
      <Card asChild>
        <section>
          <Card.Block>
            <PlannedAvailabilitySummary
              weekStart={weekStart}
              onWeekStartChange={setWeekStart}
            />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <PlannedMaintenanceSummary mode="this-week" weekStart={weekStart} />
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}
