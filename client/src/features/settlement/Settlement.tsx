import styles from "./Settlement.module.css"
import { SettlementTestForm } from "@/features/settlement/TestForm/SettlementTestForm.tsx"

export function Settlement() {
  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Settlement</h2>
      <div className={styles.content}>
        <SettlementTestForm />
      </div>
    </section>
  )
}