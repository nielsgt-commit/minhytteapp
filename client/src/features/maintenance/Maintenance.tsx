import styles from "./Maintenance.module.css"
import type { MaintenanceStatus } from "@server/db"
import { useMaintenanceTasks } from "./api/queries"
import { useSetMaintenanceStatus } from "./api/mutations"

const nextStatus: Record<MaintenanceStatus, MaintenanceStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
}

export function Maintenance() {
  const { data: tasks = [], isPending } = useMaintenanceTasks()
  const setStatus = useSetMaintenanceStatus()

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Maintenance</h2>
      <div className={styles.content}>
        {isPending ? (
          <p>Loading…</p>
        ) : (
          <ul>
            {tasks.map(t => (
              <li key={t.id}>
                [{t.status}] {t.title}
                {t.dueDate ? ` — due ${t.dueDate}` : ""}{" "}
                <button
                  onClick={() => {
                    setStatus.mutate({
                      id: t.id,
                      status: nextStatus[t.status],
                    })
                  }}
                  disabled={setStatus.isPending}
                >
                  advance
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
