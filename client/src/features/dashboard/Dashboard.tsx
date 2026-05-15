import { Suspense, useState } from "react"
import styles from "./Dashboard.module.css"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import { MyPlannedStay } from "@/features/dashboard/myplannedstay/MyPlannedStay.tsx"
import PlannedMaintenanceSummary from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import AtPropertyNow from "@/features/dashboard/capacitysummary/userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "@/features/dashboard/capacitysummary/availableparking/AvailableParking.tsx"
import RoomAvailabilityIndicator from "@/features/dashboard/capacitysummary/roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { Card, Heading, Paragraph, Tabs } from "@digdir/designsystemet-react"
import { CalendarIcon, ClockIcon, SunIcon } from "@navikt/aksel-icons"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

export function Dashboard() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const isMobile = useIsMobile()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Dashboard</h2>
        <p>No property selected. You don&apos;t own any properties yet, or none is picked from the header.</p>
      </section>
    )
  }

  if (isMobile) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Dashboard</h2>
        <MobileTabs propertyId={selectedPropertyId} />
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Dashboard</h2>
      <CapacitySummary />
      <Suspense fallback={<p>Loading…</p>}>
        <CalendarSummary />
      </Suspense>
      <Suspense fallback={<p>Loading…</p>}>
        <PlannedStaysSection propertyId={selectedPropertyId} />
      </Suspense>
    </section>
  )
}

function MobileTabs({ propertyId }: { propertyId: number }) {
  const [tab, setTab] = useState<"now" | "week" | "summer">("now")

  return (
    <Tabs className={styles.mobileTabs} value={tab} onChange={v => { setTab(v as "now" | "week" | "summer") }}>
      <Tabs.List>
        <Tabs.Tab value="now" aria-label="Now">
          <Paragraph>Now </Paragraph>
        </Tabs.Tab>
        <Tabs.Tab value="week" aria-label="This week">
          <Paragraph>This week</Paragraph>
        </Tabs.Tab>
        <Tabs.Tab value="summer" aria-label="This year">
          <Paragraph>This year</Paragraph>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value={tab}>
        {tab === "now" && (
          <Suspense fallback={<p>Loading…</p>}>
            <MobileNowPanel propertyId={propertyId} />
          </Suspense>
        )}
        {tab === "week" && (
          <Suspense fallback={<p>Loading…</p>}>
            <CalendarSummary />
          </Suspense>
        )}
        {tab === "summer" && (
          <Suspense fallback={<p>Loading…</p>}>
            <PlannedStaysSection propertyId={propertyId} />
          </Suspense>
        )}
      </Tabs.Panel>
    </Tabs>
  )
}

function MobileNowPanel({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  return (
    <div className={styles.stackedPanels}>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">At {propertyName} now</Heading>
            <AtPropertyNow />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <AvailableParking />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <RoomAvailabilityIndicator rooms={rooms} />
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}

function PlannedStaysSection({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading>This year at {propertyName}</Heading>
          <MyPlannedStay />
          <PlannedMaintenanceSummary mode="rest" />
        </Card.Block>
      </section>
    </Card>
  )
}