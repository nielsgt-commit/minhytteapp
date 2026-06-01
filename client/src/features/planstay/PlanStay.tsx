import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useTranslation } from "react-i18next"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./PlanStay.module.css"
import { AddStayFlow } from "@/features/planstay/addstayflow/AddStayFlow.tsx"

export function PlanStay() {
  const { t } = useTranslation("planstay")
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.title}>
          {t("Plan stay")}
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
        {t("Plan stay")}
      </Heading>
      <div className={styles.main}>
        <AddStayFlow propertyId={selectedPropertyId} />
      </div>
    </section>
  )
}
