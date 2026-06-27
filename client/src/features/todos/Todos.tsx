import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
  List,
  Paragraph,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
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
import type { PageHelpContent } from "@/components/shared/PageHelp"

type TargetKind = "structure" | "infrastructure" | "equipment"
type Target = { kind: TargetKind; id: number }

const NO_TARGET = ""

// Encodes a target as "<kind>:<id>" so a single <select> can carry the choice.
function parseTargetToken(token: string): Target | undefined {
  if (token === NO_TARGET) return undefined
  const [kind, idStr] = token.split(":")
  const id = Number(idStr)
  if (!Number.isFinite(id) || id <= 0) return undefined
  if (
    kind !== "structure" &&
    kind !== "infrastructure" &&
    kind !== "equipment"
  ) {
    return undefined
  }
  return { kind, id }
}

type NamedRow = { id: number; name: string }

function TargetSelect({
  name,
  value,
  onChange,
  structures,
  infrastructure,
  equipment,
}: {
  name?: string
  value?: string
  onChange?: (token: string) => void
  structures: readonly NamedRow[]
  infrastructure: readonly NamedRow[]
  equipment: readonly NamedRow[]
}) {
  const { t } = useTranslation("todos")
  return (
    <Select
      data-size="sm"
      name={name}
      aria-label={t("Target")}
      value={value}
      onChange={e => onChange?.(e.target.value)}
    >
      <Select.Option value={NO_TARGET}>
        {t("No target (general todo)")}
      </Select.Option>
      {structures.length > 0 && (
        <Select.Optgroup label={t("Building")}>
          {structures.map(s => (
            <Select.Option key={s.id} value={`structure:${String(s.id)}`}>
              {s.name}
            </Select.Option>
          ))}
        </Select.Optgroup>
      )}
      {infrastructure.length > 0 && (
        <Select.Optgroup label={t("Infrastructure")}>
          {infrastructure.map(i => (
            <Select.Option key={i.id} value={`infrastructure:${String(i.id)}`}>
              {i.name}
            </Select.Option>
          ))}
        </Select.Optgroup>
      )}
      {equipment.length > 0 && (
        <Select.Optgroup label={t("Equipment")}>
          {equipment.map(eq => (
            <Select.Option key={eq.id} value={`equipment:${String(eq.id)}`}>
              {eq.name}
            </Select.Option>
          ))}
        </Select.Optgroup>
      )}
    </Select>
  )
}

export function Todos() {
  const { t } = useTranslation("todos")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
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
    moveMutation,
  )

  const structureRows = structures ?? []
  const infrastructureRows = infrastructure ?? []
  const equipmentRows = equipment ?? []

  // Which row (if any) has its inline "Move to…" picker open.
  const [movingId, setMovingId] = useState<number | null>(null)

  // Which row (if any) has its delete button armed for confirmation.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  )

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
                  <Checkbox
                    aria-label={t("Done")}
                    checked={todo.done}
                    onChange={() => {
                      toggleDone(todo)
                    }}
                  />
                  <Paragraph
                    className={`${styles.description} ${
                      todo.done ? styles.done : ""
                    }`}
                    data-size="sm"
                  >
                    {todo.description}
                  </Paragraph>
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
                    ) : (
                      <>
                        {movingId === todo.id ? (
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
                        ) : (
                          <Button
                            variant="tertiary"
                            data-size="sm"
                            onClick={() => {
                              setMovingId(todo.id)
                            }}
                          >
                            {t("Move to...")}
                          </Button>
                        )}
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
                </List.Item>
              ))}
            </List.Unordered>
          )}
        </Card.Block>
      </Card>
    </div>
  )
}
