import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./Settlement.module.css"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"

export function Settlement() {
  const { t } = useTranslation("settlement")
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.title}>
          {t("Settlement")}
        </Heading>
        <p>
          {t("Add or select a property to balance expenses and settle up.")}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <Heading level={2} className={styles.title}>
        {t("Settlement")}
      </Heading>
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <SettlementFlow propertyId={selectedPropertyId} />
      </Suspense>
    </section>
  )
}
