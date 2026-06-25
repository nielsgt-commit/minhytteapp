import { useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Badge,
  Card,
  Heading,
  Paragraph,
  Tabs,
} from "@digdir/designsystemet-react"
import { ShoppingBasketIcon } from "@navikt/aksel-icons"
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

// The shopping tab shows the basket icon with a badge of open (unchecked)
// items and links to the shopping list rather than switching a panel.
function ShoppingListTabIcon({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const { data: items } = useQuery(
    trpc.shoppingItem.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const openCount = items?.filter(i => !i.checked).length ?? 0

  return (
    <Badge.Position placement="top-right">
      {openCount > 0 && (
        <Badge
          count={openCount}
          aria-label={t("{{count}} open shopping list items", {
            count: openCount,
          })}
        />
      )}
      <ShoppingBasketIcon aria-hidden fontSize="1.5rem" />
    </Badge.Position>
  )
}

export function MobileTabs({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("now")

  return (
    <Tabs
      className={styles.mobileTabs}
      value={tab}
      onChange={v => {
        // The shopping tab navigates away instead of switching a panel.
        if (v === "shopping") return
        setTab(v as Tab)
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="now" aria-label={t("Now")}>
          <Paragraph>{t("Now")} </Paragraph>
        </Tabs.Tab>
        <Tabs.Tab value="week" aria-label={t("This week")}>
          <Paragraph>{t("Week")}</Paragraph>
        </Tabs.Tab>
        {/* Summer tab unmounted for now */}
        {/* <Tabs.Tab value="summer" aria-label={t("Summer")}>
          <Paragraph>{t("Summer")}</Paragraph>
        </Tabs.Tab> */}
        <Tabs.Tab value="year" aria-label={t("This year")}>
          <Paragraph>{t("Year")}</Paragraph>
        </Tabs.Tab>
        <Tabs.Tab
          value="shopping"
          aria-label={t("Shopping list")}
          onClick={() => {
            void navigate({ to: "/handleliste" })
          }}
        >
          <ShoppingListTabIcon propertyId={propertyId} />
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
