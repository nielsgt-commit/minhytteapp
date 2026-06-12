import {
  useSelectedPropertyId,
  useSelectedUserId,
} from "@/selection/useSelection"
import { startTransition, useOptimistic, useState } from "react"
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
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
import { Temporal } from "temporal-polyfill"
import { isoWeekYear, startOfSunday } from "@/utils/dateUtils"
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
  const priorityYear = isoWeekYear(
    startOfSunday(Temporal.Now.plainDateISO()).add({ days: 3 }),
  )
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

  // Ids checked off but not yet confirmed by the server: the row disappears
  // instantly and reappears (with the error surfaced below) if the save fails,
  // since the optimistic set reverts when the transition settles.
  const [optimisticDoneIds, addOptimisticDoneId] = useOptimistic(
    new Set<number>(),
    (ids, id: number) => new Set(ids).add(id),
  )

  const { pending, error } = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
  )

  const handleAdd = async (fd: FormData) => {
    if (selectedUserId == null) return
    const description = fdString(fd, "description").trim()
    if (!description) return
    try {
      await createMutation.mutateAsync({
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
      })
    } catch {
      // Surfaced via the aggregated ErrorAlert below.
    }
  }

  if (!items) return <CardSkeleton />

  const todos = items
    .filter(i => {
      if (i.status !== "todo" && i.status !== "doing") return false
      if (optimisticDoneIds.has(i.id)) return false
      return scope.kind === "structure"
        ? i.structure_id === scope.id
        : scope.kind === "infrastructure"
          ? i.infrastructure_id === scope.id
          : i.equipment_id === scope.id
    })
    .slice()
    .sort((a, b) => {
      const cmp = Temporal.Instant.compare(b.created_at, a.created_at)
      if (cmp !== 0) return cmp
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
    due_at: item.due_at ?? undefined,
  })

  const markDone = (item: (typeof todos)[number]) => {
    startTransition(async () => {
      addOptimisticDoneId(item.id)
      try {
        await updateMutation.mutateAsync({
          ...baseUpdate(item),
          status: "done",
        })
      } catch {
        // The optimistic removal reverts automatically; the error is
        // surfaced via the aggregated ErrorAlert below.
      }
    })
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

  return (
    <div className={styles.wrap}>
      <form action={handleAdd} className={styles.addRow}>
        <Textfield
          aria-label={t("New task")}
          name="description"
          placeholder={t("Add task...")}
          disabled={createMutation.isPending || selectedUserId == null}
        />
        <SubmitButton disabled={selectedUserId == null}>
          {t("Add")}
        </SubmitButton>
      </form>
      <ErrorAlert error={error} />
      {todos.length === 0 ? (
        <EmptyState title={t("No active tasks.")} />
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
                        // Keyed by due_at so external changes (save/refetch)
                        // remount the select with a fresh date draft.
                        key={`${String(todo.id)}-${todo.due_at?.toString() ?? ""}`}
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
