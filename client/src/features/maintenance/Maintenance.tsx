import styles from "./Maintenance.module.css"
import { MaintenanceTestForm } from "@/features/maintenance/testform/MaintenanceTestForm.tsx"

export function Maintenance() {
  return (
    <section className={styles.page}>
        <h2 className={styles.title}>Maintenance</h2>
      <div className={styles.content}>
        <MaintenanceTestForm />
      </div>
    </section>
  )
}