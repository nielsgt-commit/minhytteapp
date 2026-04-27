import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

export function AssignedTasks() {
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: items } = useQuery(trpc.maintenance.list.queryOptions())

  if (!me || !items) return <p>Loading…</p>

  const assigned = items.filter(
    i => i.assigned_to_id === me.id && i.status !== "done",
  )

  return (
    <section>
      <h2>Assigned tasks</h2>
      {assigned.length === 0 ? (
        <p>You&apos;re all caught up — no tasks assigned to you. Enjoy the day!</p>
      ) : (
        <ul>
          {assigned.map(t => (
            <li key={t.id}>
              {t.description} ({t.status})
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
