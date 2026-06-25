import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
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
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"

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
  disabled,
  structures,
  infrastructure,
  equipment,
}: {
  name?: string
  value?: string
  onChange?: (token: string) => void
  disabled?: boolean
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
      disabled={disabled}
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
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0
  const enabled = selectedPropertyId != null

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

  // A targeted add/move lands in the maintenance views, so invalidate both.
  const invalidationKeys = [trpc.todo.pathKey(), trpc.maintenance.pathKey()]
  const createMutation = useMutationWithInvalidation(
    trpc.todo.create.mutationOptions(),
    invalidationKeys,
  )
  const updateMutation = useMutationWithInvalidation(
    trpc.todo.update.mutationOptions(),
    [trpc.todo.pathKey()],
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.todo.delete.mutationOptions(),
    [trpc.todo.pathKey()],
  )
  const moveMutation = useMutationWithInvalidation(
    trpc.todo.moveToMaintenance.mutationOptions(),
    invalidationKeys,
  )

  const { pending, error } = useMutationsStatus(
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

  const handleAdd = async (fd: FormData) => {
    if (selectedPropertyId == null) return
    const description = fdString(fd, "description").trim()
    if (!description) return
    const targetToken = fdString(fd, "target")
    const target = parseTargetToken(targetToken)
    try {
      await createMutation.mutateAsync({
        property_id: selectedPropertyId,
        description,
        ...(target ? { target } : {}),
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

  if (!items) return <CardSkeleton />

  const todos = items.slice().sort((a, b) => {
    const cmp = Temporal.Instant.compare(b.created_at, a.created_at)
    if (cmp !== 0) return cmp
    return b.id - a.id
  })

  return (
    <div className={styles.wrap}>
      <form action={handleAdd} className={styles.addRow}>
        <Textfield
          aria-label={t("New todo")}
          name="description"
          placeholder={t("Add todo...")}
          disabled={createMutation.isPending || !enabled}
        />
        <TargetSelect
          name="target"
          disabled={createMutation.isPending || !enabled}
          structures={structureRows}
          infrastructure={infrastructureRows}
          equipment={equipmentRows}
        />
        <SubmitButton disabled={!enabled}>{t("Add")}</SubmitButton>
      </form>
      <ErrorAlert error={error} />
      {todos.length === 0 ? (
        <EmptyState title={t("No todos yet.")} />
      ) : (
        <ul className={styles.list}>
          {todos.map(todo => (
            <Card asChild key={todo.id}>
              <li>
                <Card.Block className={styles.row} data-size="sm">
                  <Checkbox
                    aria-label={t("Done")}
                    checked={todo.done}
                    disabled={pending}
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
                    {movingId === todo.id ? (
                      <TargetSelect
                        value={NO_TARGET}
                        disabled={pending}
                        structures={structureRows}
                        infrastructure={infrastructureRows}
                        equipment={equipmentRows}
                        onChange={token => {
                          handleMove(todo.id, token)
                        }}
                      />
                    ) : (
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
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
