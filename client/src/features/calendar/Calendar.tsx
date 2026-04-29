import { useQuery } from "@tanstack/react-query"
import styles from "./Calendar.module.css"
import { ExperimentalWeekPanel } from "@/features/calendar/testform/ExperimentalWeekPanel.tsx"
import { MyPlannedStay } from "@/features/dashboard/myplannedstay/MyPlannedStay.tsx"
import { PriorityWeeks } from "@/features/priority/PriorityWeeks"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export function Calendar() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Calendar</h2>
        <p>Add or select a property to plan stays, block dates, and see who&apos;s booked in.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Calendar</h2>
      <div className={styles.plannedstay}>
        <MyPlannedStay />
      </div>
      {me?.is_head && (
        <div className={styles.priority}>
          <PriorityWeeks />
        </div>
      )}
      <div className={styles.week}>
        <ExperimentalWeekPanel />
      </div>
    </section>
  )
}