import styles from "./Calendar.module.css"
import { CalendarTestForm } from "@/features/calendar/TestForm/CalendarTestForm.tsx"

export function Calendar() {
  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Calendar</h2>
      <div className={styles.content}>
        <CalendarTestForm />
      </div>
    </section>
  )
}