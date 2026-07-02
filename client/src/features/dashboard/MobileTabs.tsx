import { useEffect, useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Card, Divider, Heading } from "@digdir/designsystemet-react"
import { ShoppingBasketIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { CardGallery } from "@/components/shared/CardGallery/CardGallery.tsx"
import styles from "./Dashboard.module.css"
import { useTRPC } from "@/trpc/trpc"
import { PlannedAvailabilitySummary } from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import { PlannedMaintenanceSummary } from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { AtPropertyNow } from "@/features/dashboard/capacitysummary/userscheckedin/AtPropertyNow.tsx"
import { AvailableParking } from "@/features/dashboard/capacitysummary/availableparking/AvailableParking.tsx"
import { RoomAvailabilityIndicator } from "@/features/dashboard/capacitysummary/roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { NowWeather } from "@/features/dashboard/weather/NowWeather.tsx"
import { DinnerToday } from "@/features/dashboard/dinner/DinnerToday.tsx"
import { PriorityWeeksPanel } from "./PriorityWeeksPanel"
// import { SummerSummary } from "@/features/dashboard/summersummary/SummerSummary.tsx"
import { Temporal } from "temporal-polyfill"
import { startOfSunday } from "@/utils/dateUtils"

// A floating basket button that links to the shopping list, carrying a badge of
// open (unchecked) items. It floats bottom-right, level with the gallery's
// pagination dots.
function ShoppingBasketFab({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const navigate = useNavigate()
  const trpc = useTRPC()
  const { data: items } = useQuery(
    trpc.shoppingItem.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const openCount = items?.filter(i => !i.checked).length ?? 0

  if (openCount === 0) return null

  return (
    <button
      type="button"
      className={styles.shoppingFab}
      aria-label={t("Shopping list")}
      onClick={() => {
        void navigate({ to: "/handleliste" })
      }}
    >
      <Badge.Position placement="top-right">
        <Badge
          count={openCount}
          aria-label={t("{{count}} open shopping list items", {
            count: openCount,
          })}
        />
        <ShoppingBasketIcon aria-hidden fontSize="1.5rem" />
      </Badge.Position>
    </button>
  )
}

// Fired by the bottom nav's Dashboard tab; a mounted MobileTabs answers by
// snapping the gallery back to the first ("Now") page.
export const DASHBOARD_HOME_EVENT = "minhytte:dashboard-home"

export function MobileTabs({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const [homeSignal, setHomeSignal] = useState(0)

  useEffect(() => {
    const onHome = () => {
      setHomeSignal(s => s + 1)
    }
    window.addEventListener(DASHBOARD_HOME_EVENT, onHome)
    return () => {
      window.removeEventListener(DASHBOARD_HOME_EVENT, onHome)
    }
  }, [])

  // Today, week and year are swipable full-width pages with dot pagination.
  return (
    <>
      <CardGallery
        fullWidth
        ariaLabel={t("Dashboard pages")}
        resetSignal={homeSignal}
      >
        <QueryBoundary>
          <MobileNowPanel propertyId={propertyId} />
        </QueryBoundary>
        <MobileWeekPanel />
        <MobileYearPanel propertyId={propertyId} />
      </CardGallery>
      <ShoppingBasketFab propertyId={propertyId} />
    </>
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

  return (
    <div className={styles.swipePage}>
      <Heading level={2} data-size="sm">
        {t("Now")}
      </Heading>
      <div className={styles.nowCard}>
        <Card asChild>
          <section>
            <Card.Block className={styles.nowSection}>
              <Heading level={3} data-size="xs">
                {t("Weather today")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <NowWeather />
              </QueryBoundary>
            </Card.Block>
          </section>
        </Card>
        <Card asChild>
          <section>
            <Card.Block className={styles.nowSection}>
              <Heading level={3} data-size="xs">
                {t("Checked in")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <AtPropertyNow />
              </QueryBoundary>
            </Card.Block>
          </section>
        </Card>
        <Card asChild>
          <section>
            <Card.Block className={styles.nowSection}>
              <Heading level={3} data-size="xs">
                {t("Parking")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <AvailableParking />
              </QueryBoundary>
            </Card.Block>
          </section>
        </Card>
        <Card asChild>
          <section>
            <Card.Block className={styles.nowSection}>
              <Heading level={3} data-size="xs">
                {t("Available beds")}
              </Heading>
              <Divider className={styles.divider} />
              <RoomAvailabilityIndicator rooms={rooms} />
            </Card.Block>
          </section>
        </Card>
        <Card asChild>
          <section>
            <Card.Block className={styles.nowSection}>
              <Heading level={3} data-size="xs">
                {t("Dinner")}
              </Heading>
              <Divider className={styles.divider} />
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <DinnerToday />
              </QueryBoundary>
            </Card.Block>
          </section>
        </Card>
      </div>
    </div>
  )
}

function MobileYearPanel({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")

  return (
    <div className={styles.swipePage}>
      <Heading level={2} data-size="sm">
        {t("This year")}
      </Heading>
      <Card asChild>
        <section>
          <Card.Block className={styles.nowSection}>
            <QueryBoundary>
              <PriorityWeeksPanel propertyId={propertyId} />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block className={styles.nowSection}>
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
  const { t } = useTranslation("dashboard")
  const [weekStart, setWeekStart] = useState(() =>
    startOfSunday(Temporal.Now.plainDateISO()),
  )

  return (
    <div className={styles.swipePage}>
      <Heading level={2} data-size="sm">
        {t("This week")}
      </Heading>
      <QueryBoundary>
        <PlannedAvailabilitySummary
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
        />
      </QueryBoundary>
      <QueryBoundary>
        <PlannedMaintenanceSummary mode="this-week" weekStart={weekStart} />
      </QueryBoundary>
    </div>
  )
}
