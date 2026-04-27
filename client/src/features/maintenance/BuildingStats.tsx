import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

type EditingState = { id: number } | null
type DeletingState = { id: number; typed: string } | null

export function BuildingStats({
  buildingId,
  buildingName,
}: {
  buildingId: number
  buildingName: string
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: items } = useSuspenseQuery(
    trpc.maintenance.list.queryOptions(),
  )

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

  const doneItems = items
    .filter(i => i.building_id === buildingId && i.status === "done")
    .slice()
    .sort((a, b) => {
      const aT = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bT = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return aT - bT
    })

  const pending = updateMutation.isPending || deleteMutation.isPending
  const lastError = updateMutation.error ?? deleteMutation.error

  const handleEditSubmit = (item: (typeof doneItems)[number]) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const description = String(fd.get("description") ?? "").trim()
      const summary = String(fd.get("summary") ?? "").trim()
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
      <h4>{buildingName}</h4>
      {lastError && <p role="alert">Error: {lastError.message}</p>}
      {doneItems.length === 0 ? (
        <p>No completed maintenance yet.</p>
      ) : (
        <ol>
          {doneItems.map(item => {
            const isEditing = editing?.id === item.id
            const isDeleting = deleting?.id === item.id
            const completedLabel = item.completed_at
              ? new Date(item.completed_at).toLocaleDateString()
              : ""
            return (
              <li key={item.id}>
                {isEditing ? (
                  <form onSubmit={handleEditSubmit(item)}>
                    <fieldset>
                      <legend>Edit completed task</legend>
                      <div>
                        <label>
                          Task
                          <input
                            type="text"
                            name="description"
                            defaultValue={item.description}
                            required
                          />
                        </label>
                      </div>
                      <div>
                        <label>
                          Summary
                          <input
                            type="text"
                            name="summary"
                            defaultValue={item.summary ?? ""}
                          />
                        </label>
                      </div>
                      <div>
                        <button type="submit" disabled={pending}>
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => { setEditing(null) }}
                        >
                          Cancel
                        </button>
                      </div>
                    </fieldset>
                  </form>
                ) : (
                  <div>
                    <div>
                      <strong>{item.description}</strong>
                    </div>
                    {item.summary && <div>{item.summary}</div>}
                    {completedLabel && <small>Done {completedLabel}</small>}
                    <div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => { setEditing({ id: item.id }) }}
                      >
                        Edit
                      </button>
                      {!isDeleting && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setDeleting({ id: item.id, typed: "" })
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {isDeleting && (
                      <div>
                        <p>
                          To delete, type the task name exactly:{" "}
                          <code>{item.description}</code>
                        </p>
                        <input
                          type="text"
                          value={deleting.typed}
                          onChange={e => {
                            setDeleting({
                              id: item.id,
                              typed: e.target.value,
                            })
                          }}
                        />
                        <button
                          type="button"
                          disabled={
                            pending || deleting.typed !== item.description
                          }
                          onClick={() => {
                            deleteMutation.mutate(
                              { id: item.id },
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
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}