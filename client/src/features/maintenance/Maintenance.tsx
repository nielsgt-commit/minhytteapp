import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useTranslation } from "react-i18next"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./Maintenance.module.css"
import { StructureStats } from "@/features/maintenance/structure/StructureStats.tsx"
export function Maintenance() {
  const { t } = useTranslation("maintenance")
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.title}>
          {t("Maintenance")}
        </Heading>
        <p>
          {t(
            "Add or select a property to log issues, plan upkeep, and track work across Structures.",
          )}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>{t("Maintenance")}</h2>
      <StructureStats />
    </section>
  )
}
