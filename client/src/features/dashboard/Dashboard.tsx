import { useSuspenseQuery } from "@tanstack/react-query"
import styles from "./Dashboard.module.css"
import { BuildingsTestForm } from "./TestForm/BuildingsTestForm"
import { PropertyTestForm } from "./TestForm/PropertyTestForm"
import { RoomsTestForm } from "./TestForm/RoomsTestForm"
import { UsersTestForm } from "./TestForm/UsersTestForm"
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
        <UsersTestForm />
        <PropertyTestForm />
        <BuildingsTestForm />
        <RoomsTestForm />
      </div>
    </section>
  )
}
