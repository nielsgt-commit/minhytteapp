import styles from "./Dashboard.module.css"
import BuildingSummary from "@/features/dashboard/buildingsummary/BuildingSummary"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import RoomsSummary from "@/features/dashboard/roomssummary/RoomsSummary"
import UserSummary from "@/features/dashboard/usersummary/UserSummary"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import EventSummary from "@/features/dashboard/eventsummary/EventSummary.tsx"

export function Dashboard() {
  return (


    <section className={styles.page}>
      <h2 className={styles.title}>Dashboard</h2>
      <div className={styles.content} />
      <div className={styles.capacity}>
        <CapacitySummary />
        <EventSummary />
      </div>
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
    </section>
  )
}