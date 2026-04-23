import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import styles from "./Expenses.module.css"
import { useTRPC } from "@/trpc/trpc"

export function Expenses() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.list.queryOptions(),
  )
  const createExpense = useMutation(
    trpc.expense.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.expense.list.queryKey() })
      },
    }),
  )

  const handleAddDemo = () => {
    createExpense.mutate({
      description: "Demo expense",
      amount: 100,
      payer_id: 1,
      timestamp: new Date().toISOString().slice(0, 10),
      status: "submitted",
    })
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Expenses</h2>
      <div className={styles.content}>
        <ul>
          {expenses.map(e => (
            <li key={e.id}>
              {e.timestamp} — {e.description} ({e.amount} kr,{" "}
              {e.payer_name ?? `user #${String(e.payer_id)}`})
            </li>
          ))}
        </ul>
        <button onClick={handleAddDemo} disabled={createExpense.isPending}>
          {createExpense.isPending ? "Adding…" : "Add demo expense"}
        </button>
      </div>
    </section>
  )
}