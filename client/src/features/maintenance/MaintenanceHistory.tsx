import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

type EditingState = { id: number } | null
type DeletingState = { id: number; typed: string } | null

export function MaintenanceHistory({ buildingId }: { buildingId: number }) {
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
      const aD = a.completed_at ? new Date(a.completed_at) : null
      const bD = b.completed_at ? new Date(b.completed_at) : null
      const aKey = aD ? aD.getFullYear() * 12 + aD.getMonth() : 0
      const bKey = bD ? bD.getFullYear() * 12 + bD.getMonth() : 0
      return aKey - bKey
    })

  const pending = updateMutation.isPending || deleteMutation.isPending
  const lastError = updateMutation.error ?? deleteMutation.error

  const handleEditSubmit = (item: (typeof doneItems)[number]) =>
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

  if (lastError) {
    return <p role="alert">Error: {lastError.message}</p>
  }

  if (doneItems.length === 0) {
    return <p>No completed maintenance yet.</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Done</th>
          <th>Description</th>
          <th>Summary</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {doneItems.map(item => {
          const isEditing = editing?.id === item.id
          const isDeleting = deleting?.id === item.id
          const completedLabel = item.completed_at
            ? new Date(item.completed_at).toLocaleDateString()
            : ""

          if (isEditing) {
            return (
              <tr key={item.id}>
                <td colSpan={4}>
                  <form onSubmit={handleEditSubmit(item)}>
                    <fieldset>
                      <legend>Edit completed task</legend>
                      <label>
                        Task
                        <input
                          type="text"
                          name="description"
                          defaultValue={item.description}
                          required
                        />
                      </label>
                      <label>
                        Summary
                        <input
                          type="text"
                          name="summary"
                          defaultValue={item.summary ?? ""}
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
                </td>
              </tr>
            )
          }

          return (
            <tr key={item.id}>
              <td>{completedLabel}</td>
              <td>{item.description}</td>
              <td>{item.summary ?? ""}</td>
              <td>
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
                    onClick={() => { setDeleting({ id: item.id, typed: "" }) }}
                  >
                    Delete
                  </button>
                )}
                {isDeleting && (
                  <span>
                    Type <code>{item.description}</code> to confirm:{" "}
                    <input
                      type="text"
                      value={deleting.typed}
                      onChange={e => {
                        setDeleting({ id: item.id, typed: e.target.value })
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
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}