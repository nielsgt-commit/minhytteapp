import { Suspense } from "react"
import styles from "./Dashboard.module.css"
import BuildingSummary from "@/features/dashboard/buildingsummary/BuildingSummary"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import RoomsSummary from "@/features/dashboard/roomssummary/RoomsSummary"
import UserSummary from "@/features/dashboard/usersummary/UserSummary"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import EventSummary from "@/features/dashboard/eventsummary/EventSummary.tsx"
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
      <div className={styles.content} />
      <div className={styles.capacity}>
        <CapacitySummary />
        <EventSummary />
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <div className={styles.buildings}>
          <BuildingSummary />
        </div>
        <div className={styles.users}>
          <UserSummary />
        </div>
        <div className={styles.rooms}>
          <RoomsSummary />
        </div>
        <div className={styles.calendar}>
         <CalendarSummary />
        </div>
      </Suspense>
    </section>
  )
}