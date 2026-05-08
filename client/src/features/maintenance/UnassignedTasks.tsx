import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Button, Switch, Textfield } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type EditingState = { id: number } | null
type DeletingState = { id: number; typed: string } | null

export function UnassignedTasks() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
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

  if (!items) return <p>Loading…</p>

  const unassigned = items.filter(
    i => i.assigned_to_id == null && i.status === "todo",
  )

  const pending = updateMutation.isPending || deleteMutation.isPending
  const lastError = updateMutation.error ?? deleteMutation.error

  const handleEditSubmit = (item: (typeof unassigned)[number]) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const rawDescription = fd.get("description")
      const rawInstructions = fd.get("instructions")
      const description =
        typeof rawDescription === "string" ? rawDescription.trim() : ""
      const instructions =
        typeof rawInstructions === "string" ? rawInstructions.trim() : ""
      if (!description) return
      updateMutation.mutate(
        {
          id: item.id,
          description,
          instructions: instructions || undefined,
          added_by: item.added_by,
          assigned_to_id: item.assigned_to_id ?? undefined,
          building_id: item.building_id ?? undefined,
          place_id: item.place_id ?? undefined,
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
      <h2>Unassigned tasks</h2>
      <Switch
        label="Edit mode"
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
      {lastError && <p role="alert">Error: {lastError.message}</p>}
      {unassigned.length === 0 ? (
        <p>No unassigned tasks.</p>
      ) : (
        <ul>
          {unassigned.map(t => {
            const isEditing = editMode && editing?.id === t.id
            const isDeleting = editMode && deleting?.id === t.id

            if (isEditing) {
              return (
                <li key={t.id}>
                  <form onSubmit={handleEditSubmit(t)}>
                    <fieldset>
                      <legend>Edit task</legend>
                      <Textfield
                        label="Task"
                        name="description"
                        defaultValue={t.description}
                        required
                      />
                      <Textfield
                        label="Instructions"
                        name="instructions"
                        defaultValue={t.instructions ?? ""}
                      />
                      <Button type="submit" disabled={pending}>Save</Button>
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => { setEditing(null) }}
                      >
                        Cancel
                      </Button>
                    </fieldset>
                  </form>
                </li>
              )
            }

            return (
              <li key={t.id}>
                {t.description} ({t.severity}){" "}
                {editMode && (
                  <Button
                    variant="tertiary"
                    disabled={pending}
                    onClick={() => { setEditing({ id: t.id }) }}
                  >
                    Edit
                  </Button>
                )}
                {editMode && !isDeleting && (
                  <Button
                    variant="tertiary"
                    disabled={pending}
                    onClick={() => { setDeleting({ id: t.id, typed: "" }) }}
                  >
                    Delete
                  </Button>
                )}
                {isDeleting && (
                  <span>
                    {" "}Type <code>{t.description}</code> to confirm:{" "}
                    <Textfield
                      aria-label="Type description to confirm deletion"
                      value={deleting.typed}
                      onChange={e => {
                        setDeleting({ id: t.id, typed: e.target.value })
                      }}
                    />
                    <Button
                      data-color="danger"
                      disabled={pending || deleting.typed !== t.description}
                      onClick={() => {
                        deleteMutation.mutate(
                          { id: t.id },
                          { onSuccess: () => { setDeleting(null) } },
                        )
                      }}
                    >
                      Confirm delete
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => { setDeleting(null) }}
                    >
                      Cancel
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