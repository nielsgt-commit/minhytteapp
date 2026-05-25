import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"
import styles from "./Settlement.module.css"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"

export function Settlement() {
  const { t } = useTranslation("settlement")
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2>{t("Settlement")}</h2>
        <p>{t("Add or select a property to balance expenses between owners and settle up.")}</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2>{t("Settlement")}</h2>
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <SettlementFlow propertyId={selectedPropertyId} />
      </Suspense>
    </section>
  )
}
