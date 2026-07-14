import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Dropdown,
  Heading,
  List,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { MenuElipsisVerticalIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import styles from "./Todos.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { PageHeader } from "@/components/shared/PageHeader"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { PageHelpContent } from "@/components/shared/PageHelp"
import { NO_TARGET, parseTargetToken } from "./targetToken"
import { TargetSelect } from "./TargetSelect"

export function Todos() {
  const { t } = useTranslation("todos")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const isMobile = useIsMobile()
  const propertyId = selectedPropertyId ?? 0
  const enabled = selectedPropertyId != null

  const listKey = trpc.todo.listForProperty.queryKey({
    property_id: propertyId,
  })

  const help: PageHelpContent = {
    intro: t(
      "Keep a shared todo list for the cabin. Add things to do, check them off when done, or move a todo onto a building, infrastructure or equipment.",
    ),
  }

  const { data: items } = useQuery(
    trpc.todo.listForProperty.queryOptions(
      { property_id: propertyId },
      { enabled },
    ),
  )
  const { data: structures } = useQuery(
    trpc.structure.listForProperty.queryOptions(
      { property_id: propertyId },
      { enabled },
    ),
  )
  const { data: infrastructure } = useQuery(
    trpc.infrastructure.listForProperty.queryOptions(
      { property_id: propertyId },
      { enabled },
    ),
  )
  const { data: equipment } = useQuery(
    trpc.equipment.listForProperty.queryOptions(
      { property_id: propertyId },
      { enabled },
    ),
  )
  const { data: users } = useQuery(
    trpc.user.listForProperty.queryOptions(
      { property_id: propertyId },
      { enabled },
    ),
  )

  // A "Move to…" lands the item in the maintenance views, so invalidate both.
  const invalidationKeys = [trpc.todo.pathKey(), trpc.maintenance.pathKey()]

  // Optimistic cache edits so add / toggle / delete / move take effect instantly
  // rather than waiting for the round-trip and then re-rendering, which read as a
  // flicker. onSuccess (in the wrapper) still refetches to reconcile.
  const createMutation = useMutationWithInvalidation(
    trpc.todo.create.mutationOptions({
      // A new todo sorts to the top (list is newest-first); the temp id is larger
      // than any existing id so it also wins the id tiebreak, matching where the
      // real serial id lands. Only general todos appear here — a targeted create
      // becomes a maintenance task instead.
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        if (vars.target == null) {
          qc.setQueryData(listKey, old => {
            const nextId =
              (old ?? []).reduce((max, td) => Math.max(max, td.id), 0) + 1
            return [
              {
                id: nextId,
                property_id: vars.property_id,
                description: vars.description,
                done: false,
                created_at: Temporal.Now.instant(),
                created_by: null,
                assignee_ids: [],
              },
              ...(old ?? []),
            ]
          })
        }
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    [trpc.todo.pathKey()],
  )
  const updateMutation = useMutationWithInvalidation(
    trpc.todo.update.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old =>
          old?.map(td =>
            td.id === vars.id
              ? {
                  ...td,
                  ...(vars.done !== undefined && { done: vars.done }),
                  ...(vars.description !== undefined && {
                    description: vars.description,
                  }),
                }
              : td,
          ),
        )
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    [trpc.todo.pathKey()],
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.todo.delete.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old => old?.filter(td => td.id !== vars.id))
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    [trpc.todo.pathKey()],
  )
  const assignMutation = useMutationWithInvalidation(
    trpc.todo.setAssignee.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old =>
          old?.map(td =>
            td.id === vars.id && !td.assignee_ids.includes(vars.user_id)
              ? { ...td, assignee_ids: [...td.assignee_ids, vars.user_id] }
              : td,
          ),
        )
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    [trpc.todo.pathKey()],
  )
  const unassignMutation = useMutationWithInvalidation(
    trpc.todo.removeAssignee.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old =>
          old?.map(td =>
            td.id === vars.id
              ? {
                  ...td,
                  assignee_ids: td.assignee_ids.filter(
                    id => id !== vars.user_id,
                  ),
                }
              : td,
          ),
        )
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    [trpc.todo.pathKey()],
  )
  const moveMutation = useMutationWithInvalidation(
    trpc.todo.moveToMaintenance.mutationOptions({
      // The todo leaves this list and becomes a maintenance task.
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old => old?.filter(td => td.id !== vars.id))
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    invalidationKeys,
  )

  const { error } = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
    assignMutation,
    unassignMutation,
    moveMutation,
  )

  const structureRows = structures ?? []
  const infrastructureRows = infrastructure ?? []
  const equipmentRows = equipment ?? []

  const userRows = users ?? []
  const userById = new Map(userRows.map(u => [u.id, u.name]))

  // Which row (if any) has its inline "Move to…" picker open.
  const [movingId, setMovingId] = useState<number | null>(null)

  // Which row (if any) has its inline "Assign to…" chip picker open.
  const [assigningId, setAssigningId] = useState<number | null>(null)

  // Which row (if any) has its delete button armed for confirmation.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  )

  // On mobile the row actions live behind a kebab menu; this tracks which row's
  // menu is open.
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  // Which row (if any) is being edited inline.
  const [editingId, setEditingId] = useState<number | null>(null)

  const handleConfirmDelete = (id: number) => {
    setConfirmingDeleteId(null)
    deleteMutation.mutate({ id })
  }

  // New todos always start as general todos; assigning one to a building /
  // infrastructure / equipment is done afterward via the "Move to…" action.
  const handleAdd = async (fd: FormData) => {
    if (selectedPropertyId == null) return
    const description = fdString(fd, "description").trim()
    if (!description) return
    try {
      await createMutation.mutateAsync({
        property_id: selectedPropertyId,
        description,
      })
    } catch {
      // Surfaced via the aggregated ErrorAlert below.
    }
  }

  const toggleDone = (todo: (typeof todos)[number]) => {
    if (selectedPropertyId == null) return
    updateMutation.mutate({
      property_id: selectedPropertyId,
      id: todo.id,
      done: !todo.done,
    })
  }

  const handleEdit = (id: number, fd: FormData) => {
    if (selectedPropertyId == null) return
    const description = fdString(fd, "description").trim()
    if (!description) return
    updateMutation.mutate({ property_id: selectedPropertyId, id, description })
    setEditingId(null)
  }

  const toggleAssignee = (todoId: number, userId: number, next: boolean) => {
    if (selectedPropertyId == null) return
    const vars = {
      property_id: selectedPropertyId,
      id: todoId,
      user_id: userId,
    }
    if (next) assignMutation.mutate(vars)
    else unassignMutation.mutate(vars)
  }

  const handleMove = (id: number, token: string) => {
    if (selectedPropertyId == null) return
    const target = parseTargetToken(token)
    if (!target) return
    moveMutation.mutate(
      { property_id: selectedPropertyId, id, target },
      {
        onSuccess: () => {
          setMovingId(null)
        },
      },
    )
  }

  if (!items)
    return (
      <div className={styles.wrap}>
        <PageHeader title={t("Todos")} help={help} />
        <CardSkeleton />
      </div>
    )

  const todos = items.slice().sort((a, b) => {
    const cmp = Temporal.Instant.compare(b.created_at, a.created_at)
    if (cmp !== 0) return cmp
    return b.id - a.id
  })

  // The assign picker lives in a dialog (opened from the row's kebab menu /
  // Assign to... button), so the row layout never has to make room for it.
  const assigningTodo =
    assigningId == null ? undefined : todos.find(td => td.id === assigningId)

  return (
    <div className={styles.wrap}>
      <PageHeader title={t("Todos")} help={help} />
      <ErrorAlert error={error} />
      <Card>
        <Card.Block className={styles.cardBody}>
          <form action={handleAdd} className={styles.addRow}>
            <Textfield
              aria-label={t("New todo")}
              name="description"
              placeholder={t("Add todo...")}
              disabled={!enabled}
            />
            <SubmitButton disabled={!enabled}>{t("Add")}</SubmitButton>
          </form>
          {todos.length === 0 ? (
            <EmptyState title={t("No todos yet.")} />
          ) : (
            <List.Unordered className={styles.list}>
              {todos.map(todo => (
                <List.Item className={styles.row} key={todo.id}>
                  {editingId === todo.id ? (
                    <form
                      action={fd => {
                        handleEdit(todo.id, fd)
                      }}
                      className={styles.editForm}
                    >
                      <Textfield
                        aria-label={t("Edit todo")}
                        name="description"
                        defaultValue={todo.description}
                        autoFocus
                      />
                      <SubmitButton data-size="sm">{t("Save")}</SubmitButton>
                      <Button
                        type="button"
                        variant="tertiary"
                        data-size="sm"
                        onClick={() => {
                          setEditingId(null)
                        }}
                      >
                        {t("Cancel")}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <Checkbox
                        aria-label={t("Done")}
                        checked={todo.done}
                        onChange={() => {
                          toggleDone(todo)
                        }}
                      />
                      <div className={styles.textCol}>
                        <Paragraph
                          className={`${styles.description} ${
                            todo.done ? styles.done : ""
                          }`}
                          data-size="sm"
                        >
                          {todo.description}
                        </Paragraph>
                        {todo.assignee_ids.length > 0 && (
                          <Paragraph
                            className={styles.assignees}
                            data-size="sm"
                          >
                            {todo.assignee_ids
                              .map(id => userById.get(id))
                              .filter((n): n is string => n != null)
                              .join(", ")}
                          </Paragraph>
                        )}
                      </div>
                      <div className={styles.actions}>
                        {confirmingDeleteId === todo.id ? (
                          <>
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                setConfirmingDeleteId(null)
                              }}
                            >
                              {t("Cancel")}
                            </Button>
                            <Button
                              variant="primary"
                              data-color="danger"
                              data-size="sm"
                              onClick={() => {
                                handleConfirmDelete(todo.id)
                              }}
                            >
                              {t("Confirm delete")}
                            </Button>
                          </>
                        ) : movingId === todo.id ? (
                          <>
                            <TargetSelect
                              value={NO_TARGET}
                              structures={structureRows}
                              infrastructure={infrastructureRows}
                              equipment={equipmentRows}
                              onChange={token => {
                                handleMove(todo.id, token)
                              }}
                            />
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                setMovingId(null)
                              }}
                            >
                              {t("Cancel")}
                            </Button>
                          </>
                        ) : isMobile ? (
                          <Dropdown.TriggerContext>
                            <Dropdown.Trigger
                              variant="tertiary"
                              data-size="sm"
                              icon
                              className={styles.kebab}
                              aria-label={t("Todo actions")}
                              onClick={() => {
                                setMenuOpenId(
                                  menuOpenId === todo.id ? null : todo.id,
                                )
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
                                      setAssigningId(todo.id)
                                    }}
                                  >
                                    {t("Assign to...")}
                                  </Dropdown.Button>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                  <Dropdown.Button
                                    onClick={() => {
                                      setMenuOpenId(null)
                                      setMovingId(todo.id)
                                    }}
                                  >
                                    {t("Move to...")}
                                  </Dropdown.Button>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                  <Dropdown.Button
                                    data-color="danger"
                                    onClick={() => {
                                      setMenuOpenId(null)
                                      setConfirmingDeleteId(todo.id)
                                    }}
                                  >
                                    {t("Delete")}
                                  </Dropdown.Button>
                                </Dropdown.Item>
                              </Dropdown.List>
                            </Dropdown>
                          </Dropdown.TriggerContext>
                        ) : (
                          <>
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                setEditingId(todo.id)
                              }}
                            >
                              {t("Edit")}
                            </Button>
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                setAssigningId(todo.id)
                              }}
                            >
                              {t("Assign to...")}
                            </Button>
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                setMovingId(todo.id)
                              }}
                            >
                              {t("Move to...")}
                            </Button>
                            <Button
                              variant="tertiary"
                              data-color="danger"
                              data-size="sm"
                              onClick={() => {
                                setConfirmingDeleteId(todo.id)
                              }}
                            >
                              {t("Delete")}
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </List.Item>
              ))}
            </List.Unordered>
          )}
        </Card.Block>
      </Card>
      <Dialog
        open={assigningTodo != null}
        onClose={() => {
          setAssigningId(null)
        }}
      >
        <Dialog.Block>
          <Heading level={3} data-size="xs">
            {assigningTodo?.description}
          </Heading>
          <Paragraph data-size="sm">{t("Assign to...")}</Paragraph>
        </Dialog.Block>
        <Dialog.Block>
          <div className={styles.assignChips}>
            {assigningTodo != null &&
              userRows.map(u => (
                <Chip.Checkbox
                  key={u.id}
                  data-size="sm"
                  data-color="accent"
                  checked={assigningTodo.assignee_ids.includes(u.id)}
                  onChange={e => {
                    toggleAssignee(assigningTodo.id, u.id, e.target.checked)
                  }}
                >
                  {u.name}
                </Chip.Checkbox>
              ))}
          </div>
        </Dialog.Block>
        <Dialog.Block>
          <Button
            variant="tertiary"
            data-size="sm"
            onClick={() => {
              setAssigningId(null)
            }}
          >
            {t("Close")}
          </Button>
        </Dialog.Block>
      </Dialog>
    </div>
  )
}
