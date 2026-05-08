import styles from "./Maintenance.module.css"
import { BuildingStats } from "@/features/maintenance/BuildingStats.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"

export function Maintenance() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Maintenance</h2>
        <p>Add or select a property to log issues, plan upkeep, and track work across buildings.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Maintenance</h2>
      <BuildingStats />
    </section>
  )
}