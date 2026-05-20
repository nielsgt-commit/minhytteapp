import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useQuery } from "@tanstack/react-query"
import { Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./Calendar.module.css"
import { PriorityWeeks } from "@/features/priority/PriorityWeeks"
import { useTRPC } from "@/trpc/trpc"
import { AddStayFlow } from "@/features/calendar/addstayflow/AddStayFlow.tsx"

export function Calendar() {
  const { t } = useTranslation("calendar")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.heading}>{t("Calendar")}</Heading>
        <Paragraph>{t("Add or select a property to plan stays, block dates, and see who's booked in.")}</Paragraph>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <Heading level={2} className={styles.title}>
        {t("Calendar")}
      </Heading>
      <div className={styles.main}>
        <AddStayFlow propertyId={selectedPropertyId} />
      </div>
      {me?.is_head && (
        <details className={styles.priority}>
          <summary>{t("Priority weeks")}</summary>
          <PriorityWeeks />
        </details>
      )}
    </section>
  )
}