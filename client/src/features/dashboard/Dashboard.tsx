import styles from "./Dashboard.module.css"
import { useDashboardSummary } from "./api/queries"

export function Dashboard() {
  const { data } = useDashboardSummary()

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Dashboard</h2>
      <div className={styles.content}>
        <ul>
          <li>Expenses logged: {data.expenseCount}</li>
          <li>Total spent: {data.totalSpent} kr</li>
          <li>Upcoming bookings: {data.upcomingBookings}</li>
          <li>Open maintenance tasks: {data.openMaintenance}</li>
          <li>Net balance: {data.netBalance} kr</li>
        </ul>
      </div>
    </section>
  )
}
