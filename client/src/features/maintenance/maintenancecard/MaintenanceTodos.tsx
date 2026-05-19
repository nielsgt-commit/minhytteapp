import { useSelectedUserId, useSelectedPropertyId } from "@/app/useSelectedIds"
import { type SyntheticEvent } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./MaintenanceTodos.module.css"
import {} from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { MaintenanceScope } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"

export function MaintenanceTodos({ scope }: { scope: MaintenanceScope }) {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const selectedUserId = useSelectedUserId()

  const { data: items } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
  }

  const createMutation = useMutation(
    trpc.maintenance.create.mutationOptions({ onSuccess: invalidate }),
  )
  const updateMutation = useMutation(
    trpc.maintenance.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteMutation = useMutation(
    trpc.maintenance.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedUserId == null) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const rawDescription = fd.get("description")
    const description =
      typeof rawDescription === "string" ? rawDescription.trim() : ""
    if (!description) return
    createMutation.mutate(
      {
        description,
        added_by: selectedUserId,
        ...(scope.kind === "structure"
          ? { structure_id: scope.id }
          : { infrastructure_id: scope.id }),
        category: "maintenance",
        severity: "minor",
        status: "todo",
        recurrence: "once",
      },
      { onSuccess: () => { form.reset() } },
    )
  }

  if (!items) return <p>{t("Loading…")}</p>

  const todos = items
    .filter(i => {
      if (i.status !== "todo" && i.status !== "doing") return false
      return scope.kind === "structure"
        ? i.structure_id === scope.id
        : i.infrastructure_id === scope.id
    })
    .slice()
    .sort((a, b) => {
      const aT = new Date(a.created_at).getTime()
      const bT = new Date(b.created_at).getTime()
      return bT - aT
    })

  const markDone = (item: (typeof todos)[number]) => {
    updateMutation.mutate({
      id: item.id,
      description: item.description,
      instructions: item.instructions ?? undefined,
      added_by: item.added_by,
      assigned_to_id: item.assigned_to_id ?? undefined,
      structure_id: item.structure_id ?? undefined,
      infrastructure_id: item.infrastructure_id ?? undefined,
      category: item.category,
      severity: item.severity,
      status: "done",
      recurrence: item.recurrence,
    })
  }

  const pending =
    createMutation.isPending
    || updateMutation.isPending
    || deleteMutation.isPending
  const lastError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error

  return (
    <div className={styles.wrap}>
      <form onSubmit={handleAdd} className={styles.add}>
        <Textfield
          aria-label={t("New task")}
          name="description"
          placeholder={t("Add task...")}
          disabled={createMutation.isPending || selectedUserId == null}
        />
        <Button
          type="submit"
          data-size="sm"
          disabled={createMutation.isPending || selectedUserId == null}
        >
          {t("Add")}
        </Button>
      </form>
      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}
      {todos.length === 0 ? (
        <p>{t("No active tasks.")}</p>
      ) : (
        <ul className={styles.list}>
          {todos.map(todo => (
            <Card asChild key={todo.id}>
              <li>
                <Card.Block className={styles.row} data-size="sm">
                  <Paragraph className={styles.description} data-size="sm">
                    {todo.description}
                  </Paragraph>
                  <div className={styles.actions}>
                    <Button
                      variant="tertiary"
                      data-size="sm"
                      disabled={pending}
                      onClick={() => { markDone(todo) }}
                    >
                      {t("Done")}
                    </Button>
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      onClick={() => {
                        deleteMutation.mutate({ id: todo.id })
                      }}
                    >
                      {t("Delete")}
                    </Button>
                  </div>
                </Card.Block>
              </li>
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}
