import { Suspense, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Paragraph, Tabs } from "@digdir/designsystemet-react"
import styles from "./Dashboard.module.css"
import PlannedStaysSection from "./PlannedStaysSection"
import { useTRPC } from "@/trpc/trpc"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import AtPropertyNow from "@/features/dashboard/capacitysummary/userscheckedin/AtPropertyNow.tsx"
import AvailableParking from "@/features/dashboard/capacitysummary/availableparking/AvailableParking.tsx"
import RoomAvailabilityIndicator from "@/features/dashboard/capacitysummary/roomavailabilityindicator/RoomAvailabilityIndicator.tsx"
import NowWeather from "@/features/dashboard/weather/NowWeather.tsx"

export default function MobileTabs({ propertyId }: { propertyId: number }) {
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
            <Heading level={2} data-size="xs">Weather now</Heading>
            <NowWeather />
          </Card.Block>
        </section>
      </Card>
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
            <Heading level={2} data-size="xs">Available parking</Heading>
            <AvailableParking />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">Available beds</Heading>
            <RoomAvailabilityIndicator rooms={rooms} />
          </Card.Block>
        </section>
      </Card>
    </div>
  )
}
