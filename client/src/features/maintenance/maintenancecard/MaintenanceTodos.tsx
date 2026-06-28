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
  Dropdown,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { MenuElipsisVerticalIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import type { PortableTextBlock } from "@portabletext/types"
import styles from "./MaintenanceTodos.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Temporal } from "temporal-polyfill"
import { formatDate, isoWeekYear, startOfSunday } from "@/utils/dateUtils"
import type { MaintenanceScope } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"
import { MaintenanceInstructionsPT } from "@/features/maintenance/maintenancecard/MaintenanceInstructionsPT.tsx"
import { MaintenanceInstructionsPTEditor } from "@/features/maintenance/maintenancecard/MaintenanceInstructionsPTEditor.tsx"
import {
  MaintenanceTodoEditForm,
  type MaintenanceTodoEditValues,
} from "@/features/maintenance/maintenancecard/MaintenanceTodoEditForm.tsx"
import {
  SeverityTag,
  cycleSeverity,
} from "@/features/maintenance/severity/SeverityTag.tsx"
import { MaintenanceDueSelect } from "@/features/maintenance/due/MaintenanceDueSelect.tsx"
import type { DueSelection } from "@/features/maintenance/due/maintenanceDue.ts"

export function MaintenanceTodos({ scope }: { scope: MaintenanceScope }) {
  const { t, i18n } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const selectedUserId = useSelectedUserId()
  const isMobile = useIsMobile()

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

  // Task being walked through the "mark done" confirm step, where the user can
  // record a summary of the work performed (or leave it for later).
  const [confirming, setConfirming] = useState<{ id: number } | null>(null)
  const [summaryPT, setSummaryPT] = useState<PortableTextBlock[]>([])

  // Which row's kebab actions menu (Edit / Done / Delete) is open.
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  // Which row (if any) is open in the inline full edit form.
  const [editingId, setEditingId] = useState<number | null>(null)

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

  const startDone = (item: (typeof todos)[number]) => {
    // Seed the editor with any existing execution notes so the summary builds
    // on them rather than discarding them.
    setSummaryPT(item.instructions_pt ?? [])
    setConfirming({ id: item.id })
  }

  const confirmDone = (item: (typeof todos)[number]) => {
    setConfirming(null)
    startTransition(async () => {
      addOptimisticDoneId(item.id)
      try {
        await updateMutation.mutateAsync({
          ...baseUpdate(item),
          instructions_pt: summaryPT.length > 0 ? summaryPT : null,
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

  const handleEditSubmit =
    (item: (typeof todos)[number]) => (values: MaintenanceTodoEditValues) => {
      updateMutation.mutate(
        {
          ...baseUpdate(item),
          description: values.description,
          instructions_pt: values.instructions_pt,
          due_kind: values.due.due_kind,
          due_priority_group_id: values.due.due_priority_group_id,
          due_at: values.due.due_at,
        },
        {
          onSuccess: () => {
            setEditingId(null)
          },
        },
      )
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
            const isConfirming = confirming?.id === todo.id
            const isEditing = editingId === todo.id
            // A concrete calendar date gets a static "planned" label; every
            // other due kind keeps the inline picker so it can be changed.
            const hasDate = todo.due_kind === "date" && todo.due_at != null

            const severityTag = (
              <SeverityTag
                severity={todo.severity}
                onCycle={() => {
                  cycleItemSeverity(todo)
                }}
                disabled={pending}
              />
            )

            const dueSelect = (
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
            )

            const executionChip = hasInstructions && (
              <Chip.Button
                type="button"
                data-size="sm"
                aria-expanded={isExpanded}
                onClick={() => {
                  toggleExpanded(todo.id)
                }}
              >
                {isExpanded ? t("Hide execution") : t("Show execution")}
              </Chip.Button>
            )

            const kebab = (
              <Dropdown.TriggerContext>
                <Dropdown.Trigger
                  variant="tertiary"
                  data-size="sm"
                  icon
                  aria-label={t("Task actions")}
                  disabled={pending || isConfirming}
                  onClick={() => {
                    setMenuOpenId(menuOpenId === todo.id ? null : todo.id)
                  }}
                >
                  <MenuElipsisVerticalIcon aria-hidden />
                </Dropdown.Trigger>
                <Dropdown
                  placement="bottom-end"
                  open={menuOpenId === todo.id}
                  onClose={() => {
                    setMenuOpenId(null)
                  }}
                >
                  <Dropdown.List>
                    <Dropdown.Item>
                      <Dropdown.Button
                        onClick={() => {
                          setMenuOpenId(null)
                          setEditingId(todo.id)
                        }}
                      >
                        {t("Edit")}
                      </Dropdown.Button>
                    </Dropdown.Item>
                    <Dropdown.Item>
                      <Dropdown.Button
                        onClick={() => {
                          setMenuOpenId(null)
                          startDone(todo)
                        }}
                      >
                        {t("Done")}
                      </Dropdown.Button>
                    </Dropdown.Item>
                    <Dropdown.Item>
                      <Dropdown.Button
                        data-color="danger"
                        onClick={() => {
                          setMenuOpenId(null)
                          deleteMutation.mutate({ id: todo.id })
                        }}
                      >
                        {t("Delete")}
                      </Dropdown.Button>
                    </Dropdown.Item>
                  </Dropdown.List>
                </Dropdown>
              </Dropdown.TriggerContext>
            )

            if (isEditing) {
              return (
                <Card asChild key={todo.id}>
                  <li>
                    <Card.Block data-size="sm">
                      <MaintenanceTodoEditForm
                        item={todo}
                        owners={owners}
                        pending={pending}
                        onSubmit={handleEditSubmit(todo)}
                        onCancel={() => {
                          setEditingId(null)
                        }}
                      />
                    </Card.Block>
                  </li>
                </Card>
              )
            }

            return (
              <Card asChild key={todo.id}>
                <li>
                  {isMobile ? (
                    <Card.Block className={styles.mobileBody} data-size="sm">
                      <div className={styles.mobileTop}>
                        {severityTag}
                        {kebab}
                      </div>
                      <div className={styles.field}>
                        <span className={styles.faceLabel}>{t("Task")}</span>
                        <Paragraph
                          className={styles.description}
                          data-size="sm"
                        >
                          {todo.description}
                        </Paragraph>
                      </div>
                      {executionChip && (
                        <div className={styles.field}>
                          <div className={styles.whenRow}>{executionChip}</div>
                          {isExpanded && (
                            <MaintenanceInstructionsPT
                              value={todo.instructions_pt}
                            />
                          )}
                        </div>
                      )}
                      <div className={styles.field}>
                        <span className={styles.faceLabel}>{t("Due")}</span>
                        <div className={styles.whenRow}>
                          {hasDate ? (
                            <Paragraph
                              className={styles.planned}
                              data-size="sm"
                            >
                              {t("Planned {{when}}", {
                                when: formatDate(todo.due_at, i18n.language),
                              })}
                            </Paragraph>
                          ) : (
                            dueSelect
                          )}
                        </div>
                      </div>
                    </Card.Block>
                  ) : (
                    <Card.Block className={styles.row} data-size="sm">
                      {severityTag}
                      <Paragraph className={styles.description} data-size="sm">
                        {todo.description}
                      </Paragraph>
                      <div className={styles.actions}>
                        {dueSelect}
                        {executionChip}
                        <Button
                          variant="tertiary"
                          data-size="sm"
                          disabled={pending || isConfirming}
                          onClick={() => {
                            startDone(todo)
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
                  )}
                  {!isMobile && hasInstructions && isExpanded && (
                    <Card.Block>
                      <MaintenanceInstructionsPT value={todo.instructions_pt} />
                    </Card.Block>
                  )}
                  {isConfirming && (
                    <Card.Block>
                      <div className={styles.confirm}>
                        <Paragraph data-size="sm">
                          {t(
                            "Mark this task as done. Add a summary of the work now, or leave it blank and add it later from the History tab.",
                          )}
                        </Paragraph>
                        <MaintenanceInstructionsPTEditor
                          key={`done-${String(todo.id)}`}
                          initialValue={todo.instructions_pt ?? undefined}
                          onChange={setSummaryPT}
                        />
                        <div className={styles.confirmActions}>
                          <Button
                            variant="secondary"
                            data-size="sm"
                            disabled={pending}
                            onClick={() => {
                              setConfirming(null)
                            }}
                          >
                            {t("Cancel")}
                          </Button>
                          <Button
                            data-size="sm"
                            disabled={pending}
                            onClick={() => {
                              confirmDone(todo)
                            }}
                          >
                            {t("Mark done")}
                          </Button>
                        </div>
                      </div>
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
