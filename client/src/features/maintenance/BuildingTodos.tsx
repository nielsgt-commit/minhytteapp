import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

export function BuildingTodos({ buildingId }: { buildingId: number }) {
  const trpc = useTRPC()
  const { data: items } = useQuery(trpc.maintenance.list.queryOptions())

  if (!items) return <p>Loading…</p>

  const todos = items.filter(
    i =>
      i.building_id === buildingId &&
      (i.status === "todo" || i.status === "doing"),
  )

  if (todos.length === 0) return <p>No active tasks.</p>

  return (
    <ul>
      {todos.map(t => (
        <li key={t.id}>
          {t.description} ({t.status})
        </li>
      ))}
    </ul>
  )
}