import { Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import styles from "./Settlement.module.css"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"
import { SettlementTestForm } from "@/features/settlement/testform/SettlementTestForm.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export function Settlement() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: me } = useQuery(trpc.user.me.queryOptions())

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
      {me?.is_head && (
        <Suspense fallback={<p>Loading…</p>}>
          <SettlementTestForm />
        </Suspense>
      )}
    </section>
  )
}
