import { useQuery } from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function BuildingTodos({ buildingId }: { buildingId: number }) {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: items } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

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