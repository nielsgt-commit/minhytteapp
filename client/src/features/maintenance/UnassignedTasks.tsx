import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

type EditingState = { id: number } | null
type DeletingState = { id: number; typed: string } | null

export function UnassignedTasks() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: items } = useQuery(trpc.maintenance.list.queryOptions())

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.maintenance.list.queryKey() })
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
      const rawSummary = fd.get("summary")
      const description =
        typeof rawDescription === "string" ? rawDescription.trim() : ""
      const summary = typeof rawSummary === "string" ? rawSummary.trim() : ""
      if (!description) return
      updateMutation.mutate(
        {
          id: item.id,
          description,
          summary: summary || undefined,
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
      <label>
        <input
          type="checkbox"
          checked={editMode}
          onChange={e => {
            const next = e.currentTarget.checked
            setEditMode(next)
            if (!next) {
              setEditing(null)
              setDeleting(null)
            }
          }}
        />
        Edit mode
      </label>
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
                      <label>
                        Task
                        <input
                          type="text"
                          name="description"
                          defaultValue={t.description}
                          required
                        />
                      </label>
                      <label>
                        Summary
                        <input
                          type="text"
                          name="summary"
                          defaultValue={t.summary ?? ""}
                        />
                      </label>
                      <button type="submit" disabled={pending}>Save</button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => { setEditing(null) }}
                      >
                        Cancel
                      </button>
                    </fieldset>
                  </form>
                </li>
              )
            }

            return (
              <li key={t.id}>
                {t.description} ({t.severity}){" "}
                {editMode && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setEditing({ id: t.id }) }}
                  >
                    Edit
                  </button>
                )}
                {editMode && !isDeleting && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setDeleting({ id: t.id, typed: "" }) }}
                  >
                    Delete
                  </button>
                )}
                {isDeleting && (
                  <span>
                    {" "}Type <code>{t.description}</code> to confirm:{" "}
                    <input
                      type="text"
                      value={deleting.typed}
                      onChange={e => {
                        setDeleting({ id: t.id, typed: e.target.value })
                      }}
                    />
                    <button
                      type="button"
                      disabled={pending || deleting.typed !== t.description}
                      onClick={() => {
                        deleteMutation.mutate(
                          { id: t.id },
                          { onSuccess: () => { setDeleting(null) } },
                        )
                      }}
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => { setDeleting(null) }}
                    >
                      Cancel
                    </button>
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