import { useEffect, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Card, Divider, Heading } from "@digdir/designsystemet-react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PackageIcon,
  PersonGroupIcon,
  ShoppingBasketIcon,
} from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { CardGallery } from "@/components/shared/CardGallery/CardGallery.tsx"
import styles from "./Dashboard.module.css"
import { useTRPC } from "@/trpc/trpc"
import { PlannedAvailabilitySummary } from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import { PlannedMaintenanceSummary } from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { AtPropertyNow } from "@/features/dashboard/capacitysummary/userscheckedin/AtPropertyNow.tsx"
// import { AvailableParking } from "@/features/dashboard/capacitysummary/availableparking/AvailableParking.tsx"
// import { AvailableBedsToday } from "@/features/dashboard/capacitysummary/roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { NowWeather } from "@/features/dashboard/weather/NowWeather.tsx"
// import { DinnerToday } from "@/features/dashboard/dinner/DinnerToday.tsx"
import { PriorityWeeksPanel } from "./PriorityWeeksPanel"
// import { SummerSummary } from "@/features/dashboard/summersummary/SummerSummary.tsx"
import { Temporal } from "temporal-polyfill"
import { startOfSunday } from "@/utils/dateUtils"
import { DASHBOARD_HOME_EVENT } from "@/components/shared/BottomNavBar"

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

// A floating package button that links to the general inventory. Always
// visible (the inventory is a browsing destination, meaningful when empty),
// in a stable slot above the basket FAB so it never jumps when the basket
// appears or disappears.
function InventoryFab() {
  const { t } = useTranslation("dashboard")
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={styles.inventoryFab}
      aria-label={t("Inventory")}
      onClick={() => {
        void navigate({ to: "/inventar" })
      }}
    >
      <PackageIcon aria-hidden fontSize="1.5rem" />
    </button>
  )
}

// A floating contacts button that links to the property contact list. Always
// visible, in a stable slot above the inventory FAB.
function ContactsFab() {
  const { t } = useTranslation("dashboard")
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={styles.contactsFab}
      aria-label={t("Contacts")}
      onClick={() => {
        void navigate({ to: "/kontakter" })
      }}
    >
      <PersonGroupIcon aria-hidden fontSize="1.5rem" />
    </button>
  )
}

// snapping the gallery back to the first ("Now") page.

// Gallery page indices, in child order below.
const WEEK_PAGE = 1

export function MobileTabs({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const [homeSignal, setHomeSignal] = useState(0)
  const [activePage, setActivePage] = useState(0)

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
        onActiveChange={setActivePage}
      >
        <QueryBoundary>
          <MobileNowPanel />
        </QueryBoundary>
        <MobileWeekPanel galleryActive={activePage === WEEK_PAGE} />
        <MobileYearPanel propertyId={propertyId} />
      </CardGallery>
      <ContactsFab />
      <InventoryFab />
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

function MobileNowPanel() {
  const { t } = useTranslation("dashboard")

  return (
    <div className={styles.swipePage}>
      <Heading level={2} data-size="sm">
        {t("Today")}
      </Heading>
      <div className={styles.nowCard}>
        <Card asChild>
          <section>
            <Card.Block className={styles.nowSection}>
              <Heading level={3} data-size="xs">
                {t("Weather")}
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
        {/* Stashed for now: parking, available beds and dinner panels.
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
              <QueryBoundary fallback={<CardSkeleton lines={1} />}>
                <AvailableBedsToday />
              </QueryBoundary>
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
        */}
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

// While the week page is the active gallery page and today's day card (marked
// with [data-today-card] by DayCard) is scrolled out of the viewport, float an
// arrow FAB just above the gallery's dot pill — pointing towards the card, so
// down when it's below the view and up when it's been scrolled past; tapping
// it scrolls the card to the centre of the view. The IntersectionObserver is
// (re)attached via a MutationObserver because the card mounts late (suspense)
// and remounts on week navigation — and disappears entirely on non-current
// weeks, which hides the FAB.
function ScrollToTodayFab({
  enabled,
  pageRef,
}: {
  enabled: boolean
  pageRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation("dashboard")
  const [direction, setDirection] = useState<"up" | "down" | null>(null)

  useEffect(() => {
    if (!enabled) {
      setDirection(null)
      return
    }
    const page = pageRef.current
    if (!page) return
    let io: IntersectionObserver | null = null
    const attach = () => {
      io?.disconnect()
      io = null
      const card = page.querySelector("[data-today-card]")
      if (!card) {
        setDirection(null)
        return
      }
      io = new IntersectionObserver(([entry]) => {
        setDirection(
          entry.isIntersecting
            ? null
            : entry.boundingClientRect.top < 0
              ? "up"
              : "down",
        )
      })
      io.observe(card)
    }
    attach()
    const mo = new MutationObserver(attach)
    mo.observe(page, { childList: true, subtree: true })
    return () => {
      io?.disconnect()
      mo.disconnect()
    }
  }, [enabled, pageRef])

  if (!direction) return null

  // Portalled to <body>: the gallery track is CSS-transformed, which would
  // otherwise become the containing block for position: fixed and drag the
  // button along as pages swipe (and clip it under the viewport's overflow).
  return createPortal(
    <button
      type="button"
      className={styles.todayFab}
      aria-label={t("Scroll to today")}
      onClick={() => {
        pageRef.current
          ?.querySelector("[data-today-card]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }}
    >
      {direction === "up" ? (
        <ArrowUpIcon aria-hidden fontSize="1.5rem" />
      ) : (
        <ArrowDownIcon aria-hidden fontSize="1.5rem" />
      )}
    </button>,
    document.body,
  )
}

function MobileWeekPanel({ galleryActive }: { galleryActive: boolean }) {
  const { t } = useTranslation("dashboard")
  const [weekStart, setWeekStart] = useState(() =>
    startOfSunday(Temporal.Now.plainDateISO()),
  )
  const pageRef = useRef<HTMLDivElement>(null)

  return (
    <div className={styles.swipePage} ref={pageRef}>
      <Heading level={2} data-size="sm">
        {t("This week")}
      </Heading>
      <QueryBoundary>
        <PlannedAvailabilitySummary
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
        />
      </QueryBoundary>
      <Card asChild>
        <section>
          <Card.Block className={styles.nowSection}>
            <QueryBoundary>
              <PlannedMaintenanceSummary
                mode="this-week"
                weekStart={weekStart}
              />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <ScrollToTodayFab enabled={galleryActive} pageRef={pageRef} />
    </div>
  )
}
