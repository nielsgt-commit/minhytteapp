import { Suspense } from "react"
import styles from "./Settlement.module.css"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export function Settlement() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

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
