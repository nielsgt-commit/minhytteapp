import { Suspense } from "react"
import styles from "./Dashboard.module.css"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import { MyPlannedStay } from "@/features/dashboard/myplannedstay/MyPlannedStay.tsx"
import PlannedMaintenanceSummary from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { Card, Heading } from "@digdir/designsystemet-react"

export function Dashboard() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Dashboard</h2>
        <p>No property selected. You don&apos;t own any properties yet, or none is picked from the header.</p>
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
          <Heading>This summer at {propertyName}</Heading>
          <MyPlannedStay />
          <PlannedMaintenanceSummary mode="rest" />
        </Card.Block>
      </section>
    </Card>
  )
}