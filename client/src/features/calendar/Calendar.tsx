import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useTranslation } from "react-i18next"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./Calendar.module.css"
import { AddStayFlow } from "@/features/calendar/addstayflow/AddStayFlow.tsx"

export function Calendar() {
  const { t } = useTranslation("calendar")
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.title}>
          {t("Calendar")}
        </Heading>
        <p>
          {t(
            "Add or select a property to plan stays, block dates, and see who's booked in.",
          )}
        </p>
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
    </section>
  )
}
