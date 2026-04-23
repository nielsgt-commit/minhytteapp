import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import styles from "./Settlement.module.css"
import { useTRPC } from "@/trpc/trpc"

export function Settlement() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.list.queryOptions(),
  )
  const createSettlement = useMutation(
    trpc.settlement.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: trpc.settlement.list.queryKey(),
        })
      },
    }),
  )

  const handleAddDemo = () => {
    createSettlement.mutate({
      year: new Date().getFullYear(),
      status: "open",
      split_policy: "shares",
    })
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Settlement</h2>
      <div className={styles.content}>
        <ul>
          {settlements.map(s => (
            <li key={s.id}>
              {s.year}
              {s.season ? ` ${s.season}` : ""} — {s.status} ({s.split_policy})
            </li>
          ))}
        </ul>
        <button
          onClick={handleAddDemo}
          disabled={createSettlement.isPending}
        >
          {createSettlement.isPending ? "Adding…" : "Add demo settlement"}
        </button>
      </div>
    </section>
  )
}