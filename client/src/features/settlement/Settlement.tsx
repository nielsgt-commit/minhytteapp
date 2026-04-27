import styles from "./Settlement.module.css"
import { SettlementTestForm } from "@/features/settlement/testform/SettlementTestForm.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export function Settlement() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Settlement</h2>
        <p>Add or select a property to balance expenses between owners and settle up.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Settlement</h2>
      <div className={styles.content}>
        <SettlementTestForm />
      </div>
    </section>
  )
}