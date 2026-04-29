import styles from "./Calendar.module.css"
import { CalendarTestForm } from "@/features/calendar/testform/CalendarTestForm.tsx"
import { ExperimentalWeekPanel } from "@/features/calendar/testform/ExperimentalWeekPanel.tsx"
import { WeekRadioPanel } from "@/features/calendar/testform/WeekRadioPanel.tsx"
import { PriorityWeeks } from "@/features/priority/PriorityWeeks"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export function Calendar() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

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
      <div className={styles.content}>
        <PriorityWeeks />
        <ExperimentalWeekPanel />
      </div>
    </section>
  )
}