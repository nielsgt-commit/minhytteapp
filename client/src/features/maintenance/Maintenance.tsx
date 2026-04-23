import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import styles from "./Maintenance.module.css"
import { useTRPC } from "@/trpc/trpc"

export function Maintenance() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: tasks } = useSuspenseQuery(
    trpc.maintenance.list.queryOptions(),
  )
  const createTask = useMutation(
    trpc.maintenance.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey(),
        })
      },
    }),
  )

  const handleAddDemo = () => {
    createTask.mutate({
      description: "Demo maintenance task",
      added_by: 1,
      building_id: 1,
      category: "other",
      severity: "minor",
      status: "todo",
      recurrence: "ephemeral",
    })
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Maintenance</h2>
      <div className={styles.content}>
        <ul>
          {tasks.map(t => (
            <li key={t.id}>
              [{t.status}] {t.description}
            </li>
          ))}
        </ul>
        <button onClick={handleAddDemo} disabled={createTask.isPending}>
          {createTask.isPending ? "Adding…" : "Add demo task"}
        </button>
      </div>
    </section>
  )
}