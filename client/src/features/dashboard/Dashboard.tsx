import { Suspense } from "react"
import styles from "./Dashboard.module.css"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import PropertyStats from "@/features/dashboard/propertystats/PropertyStats"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

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
        <PropertyStats />
      </Suspense>
    </section>
  )
}