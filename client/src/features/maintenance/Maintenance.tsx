import styles from "./Maintenance.module.css"
import { MaintenanceTestForm } from "@/features/maintenance/testform/MaintenanceTestForm.tsx"
import { BuildingStats } from "@/features/maintenance/BuildingStats.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { AssignedTasks } from "@/features/maintenance/AssignedTasks.tsx"
import { UnassignedTasks } from "@/features/maintenance/UnassignedTasks.tsx"
import { Equipment } from "@/features/maintenance/Equipment.tsx"

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
      <div className={styles.buildings}>
        <BuildingStats />
      </div>
      <div className={styles.equipment}>
        <Equipment />
      </div>
      <div className={styles.assigned}>
        <AssignedTasks />
      </div>
      <div className={styles.unassigned}>
        <UnassignedTasks />
      </div>
      <div className={styles.testform}>
        <MaintenanceTestForm />
      </div>
    </section>
  )
}