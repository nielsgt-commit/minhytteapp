import { useSelectedPropertyId } from "@/app/useSelectedIds"
import styles from "./Maintenance.module.css"
import { StructureStats } from "@/features/maintenance/structure/StructureStats.tsx"
export function Maintenance() {
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Maintenance</h2>
        <p>Add or select a property to log issues, plan upkeep, and track work across Structures.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Maintenance</h2>
      <StructureStats />
    </section>
  )
}