import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Textfield } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type EditingState = { id: number } | null
type DeletingState = { id: number; typed: string } | null

export function MaintenanceHistory({ buildingId }: { buildingId: number }) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: items } = useSuspenseQuery(
    trpc.maintenance.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
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
          <th>Instructions</th>
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
                      <Textfield
                        label="Task"
                        name="description"
                        defaultValue={item.description}
                        required
                      />
                      <Textfield
                        label="Instructions"
                        name="instructions"
                        defaultValue={item.instructions ?? ""}
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
                </td>
              </tr>
            )
          }

          return (
            <tr key={item.id}>
              <td>{completedLabel}</td>
              <td>{item.description}</td>
              <td>{item.instructions ?? ""}</td>
              <td>
                <Button
                  variant="tertiary"
                  disabled={pending}
                  onClick={() => { setEditing({ id: item.id }) }}
                >
                  Edit
                </Button>
                {!isDeleting && (
                  <Button
                    variant="tertiary"
                    disabled={pending}
                    onClick={() => { setDeleting({ id: item.id, typed: "" }) }}
                  >
                    Delete
                  </Button>
                )}
                {isDeleting && (
                  <span>
                    Type <code>{item.description}</code> to confirm:{" "}
                    <Textfield
                      aria-label="Type description to confirm deletion"
                      value={deleting.typed}
                      onChange={e => {
                        setDeleting({ id: item.id, typed: e.target.value })
                      }}
                    />
                    <Button
                      data-color="danger"
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
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}