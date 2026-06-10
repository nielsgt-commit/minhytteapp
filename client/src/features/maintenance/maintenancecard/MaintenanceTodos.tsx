import {
  useSelectedPropertyId,
  useSelectedUserId,
} from "@/selection/useSelection"
import { type SyntheticEvent, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Chip,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./MaintenanceTodos.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { addDays, isoWeekYear, startOfSunday } from "@/utils/dateUtils"
import type { MaintenanceScope } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"
import { MaintenanceInstructionsPT } from "@/features/maintenance/maintenancecard/MaintenanceInstructionsPT.tsx"
import {
  SeverityTag,
  cycleSeverity,
} from "@/features/maintenance/severity/SeverityTag.tsx"
import { MaintenanceDueSelect } from "@/features/maintenance/due/MaintenanceDueSelect.tsx"
import type { DueSelection } from "@/features/maintenance/due/maintenanceDue.ts"

export function MaintenanceTodos({ scope }: { scope: MaintenanceScope }) {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const selectedUserId = useSelectedUserId()

  const { data: items } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  // Mirror PlannedMaintenanceSummary's current-week refYear (isoWeekYear of the
  // week's midpoint) so this query shares its cache key and the two agree at the
  // ISO-week/year boundary in late December. Only eligibleOwners is consumed
  // here (year-independent); the year just drives the shared cache key.
  const priorityYear = isoWeekYear(addDays(startOfSunday(new Date()), 3))
  const { data: priority } = useQuery(
    trpc.priority.list.queryOptions(
      {
        property_id: selectedPropertyId ?? 0,
        year: priorityYear,
      },
      { enabled: selectedPropertyId != null },
    ),
  )
  const owners = priority?.eligibleOwners ?? []

  const maintenanceKeys = [trpc.maintenance.pathKey()]
  const createMutation = useMutationWithInvalidation(
    trpc.maintenance.create.mutationOptions(),
    maintenanceKeys,
  )
  const updateMutation = useMutationWithInvalidation(
    trpc.maintenance.update.mutationOptions(),
    maintenanceKeys,
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.maintenance.delete.mutationOptions(),
    maintenanceKeys,
  )

  const [expanded, setExpanded] = useState<Set<number>>(new Set())

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
        ...(scope.kind === "structure"
          ? { structure_id: scope.id }
          : scope.kind === "infrastructure"
            ? { infrastructure_id: scope.id }
            : { equipment_id: scope.id }),
        category: "maintenance",
        severity: "patch",
        status: "todo",
        recurrence: "once",
        // Created as 'not_decided' (server default); the due — including the
        // date picker — is set afterward on the task's own card.
      },
      {
        onSuccess: () => {
          form.reset()
        },
      },
    )
  }

  if (!items) return <p>{t("Loading…")}</p>

  const todos = items
    .filter(i => {
      if (i.status !== "todo" && i.status !== "doing") return false
      return scope.kind === "structure"
        ? i.structure_id === scope.id
        : scope.kind === "infrastructure"
          ? i.infrastructure_id === scope.id
          : i.equipment_id === scope.id
    })
    .slice()
    .sort((a, b) => {
      const aT = new Date(a.created_at).getTime()
      const bT = new Date(b.created_at).getTime()
      if (bT !== aT) return bT - aT
      return b.id - a.id
    })

  const baseUpdate = (item: (typeof todos)[number]) => ({
    id: item.id,
    description: item.description,
    instructions_pt: item.instructions_pt,
    assigned_to_id: item.assigned_to_id ?? undefined,
    structure_id: item.structure_id ?? undefined,
    infrastructure_id: item.infrastructure_id ?? undefined,
    equipment_id: item.equipment_id ?? undefined,
    category: item.category,
    severity: item.severity,
    status: item.status,
    recurrence: item.recurrence,
    due_kind: item.due_kind,
    due_priority_group_id: item.due_priority_group_id ?? undefined,
    due_at: item.due_at ? new Date(item.due_at) : undefined,
  })

  const markDone = (item: (typeof todos)[number]) => {
    updateMutation.mutate({ ...baseUpdate(item), status: "done" })
  }

  const cycleItemSeverity = (item: (typeof todos)[number]) => {
    updateMutation.mutate({
      ...baseUpdate(item),
      severity: cycleSeverity(item.severity),
    })
  }

  const setItemDue = (
    item: (typeof todos)[number],
    selection: DueSelection,
  ) => {
    updateMutation.mutate({
      ...baseUpdate(item),
      due_kind: selection.due_kind,
      due_priority_group_id: selection.due_priority_group_id,
      due_at: selection.due_at,
    })
  }

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending
  const lastError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error

  return (
    <div className={styles.wrap}>
      <form onSubmit={handleAdd} className={styles.addRow}>
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
      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}
      {todos.length === 0 ? (
        <p>{t("No active tasks.")}</p>
      ) : (
        <ul className={styles.list}>
          {todos.map(todo => {
            const hasInstructions =
              todo.instructions_pt != null && todo.instructions_pt.length > 0
            const isExpanded = expanded.has(todo.id)
            return (
              <Card asChild key={todo.id}>
                <li>
                  <Card.Block className={styles.row} data-size="sm">
                    <SeverityTag
                      severity={todo.severity}
                      onCycle={() => {
                        cycleItemSeverity(todo)
                      }}
                      disabled={pending}
                    />
                    <Paragraph className={styles.description} data-size="sm">
                      {todo.description}
                    </Paragraph>
                    <div className={styles.actions}>
                      <MaintenanceDueSelect
                        value={{
                          due_kind: todo.due_kind,
                          due_priority_group_id: todo.due_priority_group_id,
                          due_at: todo.due_at,
                        }}
                        owners={owners}
                        disabled={pending}
                        onChange={selection => {
                          setItemDue(todo, selection)
                        }}
                      />
                      {hasInstructions && (
                        <Chip.Button
                          type="button"
                          data-size="sm"
                          aria-expanded={isExpanded}
                          onClick={() => {
                            toggleExpanded(todo.id)
                          }}
                        >
                          {isExpanded
                            ? t("Hide execution")
                            : t("Show execution")}
                        </Chip.Button>
                      )}
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => {
                          markDone(todo)
                        }}
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
                  {hasInstructions && isExpanded && (
                    <Card.Block>
                      <MaintenanceInstructionsPT value={todo.instructions_pt} />
                    </Card.Block>
                  )}
                </li>
              </Card>
            )
          })}
        </ul>
      )}
    </div>
  )
}
