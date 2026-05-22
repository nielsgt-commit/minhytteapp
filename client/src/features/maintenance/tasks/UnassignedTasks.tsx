import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Field,
  Fieldset,
  Label,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import type { PortableTextBlock } from "@portabletext/types"
import { useTRPC } from "@/trpc/trpc.ts"
import { MaintenanceInstructionsPTEditor } from "@/features/maintenance/maintenancecard/MaintenanceInstructionsPTEditor.tsx"

type EditingState = { id: number; pt: PortableTextBlock[] } | null
type DeletingState = { id: number; typed: string } | null

export function UnassignedTasks() {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: items } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
  }

  const updateMutation = useMutation(
    trpc.maintenance.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteMutation = useMutation(
    trpc.maintenance.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editing, setEditing] = useState<EditingState>(null)
  const [deleting, setDeleting] = useState<DeletingState>(null)
  const [editMode, setEditMode] = useState(false)

  if (!items) return <p>{t("Loading…")}</p>

  const unassigned = items.filter(
    i => i.assigned_to_id == null && i.status === "todo",
  )

  const pending = updateMutation.isPending || deleteMutation.isPending
  const lastError = updateMutation.error ?? deleteMutation.error

  const handleEditSubmit = (
    item: (typeof unassigned)[number],
    pt: PortableTextBlock[],
  ) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const rawDescription = fd.get("description")
      const description =
        typeof rawDescription === "string" ? rawDescription.trim() : ""
      if (!description) return
      updateMutation.mutate(
        {
          id: item.id,
          description,
          instructions_pt: pt.length > 0 ? pt : null,
          added_by: item.added_by,
          assigned_to_id: item.assigned_to_id ?? undefined,
          structure_id: item.structure_id ?? undefined,
          infrastructure_id: item.infrastructure_id ?? undefined,
          category: item.category,
          severity: item.severity,
          status: item.status,
          recurrence: item.recurrence,
        },
        { onSuccess: () => { setEditing(null) } },
      )
    }

  return (
    <section>
      <h2>{t("Unassigned tasks")}</h2>
      <Switch
        label={t("Edit mode")}
        checked={editMode}
        onChange={e => {
          const next = e.target.checked
          setEditMode(next)
          if (!next) {
            setEditing(null)
            setDeleting(null)
          }
        }}
      />
      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}
      {unassigned.length === 0 ? (
        <p>{t("No unassigned tasks.")}</p>
      ) : (
        <ul>
          {unassigned.map(task => {
            const isEditing = editMode && editing?.id === task.id
            const isDeleting = editMode && deleting?.id === task.id

            if (isEditing) {
              return (
                <li key={task.id}>
                  <form onSubmit={handleEditSubmit(task, editing.pt)}>
                    <Fieldset>
                      <Fieldset.Legend>{t("Edit task")}</Fieldset.Legend>
                      <Textfield
                        label={t("Task")}
                        name="description"
                        defaultValue={task.description}
                        required
                      />
                      <Field>
                        <Label>{t("Description")}</Label>
                        <MaintenanceInstructionsPTEditor
                          initialValue={task.instructions_pt ?? undefined}
                          onChange={(pt) => {
                            setEditing({ id: task.id, pt })
                          }}
                        />
                      </Field>
                      <Button type="submit" disabled={pending}>{t("Save")}</Button>
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => { setEditing(null) }}
                      >
                        {t("Cancel")}
                      </Button>
                    </Fieldset>
                  </form>
                </li>
              )
            }

            return (
              <li key={task.id}>
                {task.description} ({task.severity}){" "}
                {editMode && (
                  <Button
                    variant="tertiary"
                    disabled={pending}
                    onClick={() => {
                      setEditing({
                        id: task.id,
                        pt: task.instructions_pt ?? [],
                      })
                    }}
                  >
                    {t("Edit")}
                  </Button>
                )}
                {editMode && !isDeleting && (
                  <Button
                    variant="tertiary"
                    disabled={pending}
                    onClick={() => { setDeleting({ id: task.id, typed: "" }) }}
                  >
                    {t("Delete")}
                  </Button>
                )}
                {isDeleting && (
                  <span>
                    {" "}<Trans
                      ns="maintenance"
                      i18nKey="Type <0>{{description}}</0> to confirm:"
                      values={{ description: task.description }}
                      components={[<code key="0" />]}
                    />{" "}
                    <Textfield
                      aria-label={t("Type description to confirm deletion")}
                      value={deleting.typed}
                      onChange={e => {
                        setDeleting({ id: task.id, typed: e.target.value })
                      }}
                    />
                    <Button
                      data-color="danger"
                      disabled={pending || deleting.typed !== task.description}
                      onClick={() => {
                        deleteMutation.mutate(
                          { id: task.id },
                          { onSuccess: () => { setDeleting(null) } },
                        )
                      }}
                    >
                      {t("Confirm delete")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => { setDeleting(null) }}
                    >
                      {t("Cancel")}
                    </Button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
