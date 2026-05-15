import { useQuery } from "@tanstack/react-query"
import { Heading, Paragraph } from "@digdir/designsystemet-react"
import styles from "./Calendar.module.css"
import { Agent3Calendar } from "@/features/calendar/agent3/Agent3Calendar"
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
        <Heading level={2} style={{ margin: 0 }}>Calendar</Heading>
        <Paragraph>Add or select a property to plan stays, block dates, and see who&apos;s booked in.</Paragraph>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <Heading level={2} style={{ margin: 0 }}>Calendar</Heading>
      <div className={styles.main}>
        <Agent3Calendar />
      </div>
      {me?.is_head && (
        <details className={styles.priority}>
          <summary>Priority weeks</summary>
          <PriorityWeeks />
        </details>
      )}
    </section>
  )
}