import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { Suspense } from "react"
import styles from "./Settlement.module.css"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"

export function Settlement() {
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2>Settlement</h2>
        <p>Add or select a property to balance expenses between owners and settle up.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2>Settlement</h2>
      <Suspense fallback={<p>Loading…</p>}>
        <SettlementFlow propertyId={selectedPropertyId} />
      </Suspense>
    </section>
  )
}
