import styles from "./Maintenance.module.css"
import { StructureStats } from "@/features/maintenance/StructureStats.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"

export function Maintenance() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

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