import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"

export function AssignedTasks() {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: items } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  if (!me || !items) return <p>{t("Loading…")}</p>

  const assigned = items.filter(
    i => i.assigned_to_id === me.id && i.status !== "done",
  )

  return (
    <section>
      <h2>{t("Assigned tasks")}</h2>
      {assigned.length === 0 ? (
        <p>{t("You're all caught up — no tasks assigned to you. Enjoy the day!")}</p>
      ) : (
        <ul>
          {assigned.map(task => (
            <li key={task.id}>
              {task.description} ({task.status})
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
