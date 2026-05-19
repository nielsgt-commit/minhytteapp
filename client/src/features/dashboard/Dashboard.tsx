import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { Suspense } from "react"
import styles from "./Dashboard.module.css"
import MobileTabs from "./MobileTabs"
import PlannedStaysSection from "./PlannedStaysSection"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

export function Dashboard() {
  const selectedPropertyId = useSelectedPropertyId()
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
