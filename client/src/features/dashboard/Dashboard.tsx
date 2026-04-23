import { useSuspenseQuery } from "@tanstack/react-query"
import styles from "./Dashboard.module.css"
import { PropertyFlow } from "./TestForm/PropertyFlow"
import { useTRPC } from "@/trpc/trpc"

export function Dashboard() {
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(trpc.dashboard.summary.queryOptions())

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Dashboard</h2>
      <div className={styles.content}>
        <ul>
          <li>Expenses logged: {data.expenseCount}</li>
          <li>Total spent: {data.totalSpent} kr</li>
          <li>Upcoming bookings: {data.upcomingBookings}</li>
          <li>Open maintenance tasks: {data.openMaintenance}</li>
        </ul>
        <PropertyFlow />
      </div>
    </section>
  )
}
