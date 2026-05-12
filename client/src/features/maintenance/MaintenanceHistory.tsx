import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Card, Paragraph, Textfield } from "@digdir/designsystemet-react"
import styles from "./MaintenanceHistory.module.css"
import type { MaintenanceScope } from "@/features/maintenance/MaintenanceCard.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type EditingState = { id: number } | null
type DeletingState = { id: number; typed: string } | null

export function MaintenanceHistory({ scope }: { scope: MaintenanceScope }) {
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

  const matchesScope = (i: (typeof items)[number]) =>
    scope.kind === "building"
      ? i.building_id === scope.id
      : i.place_id === scope.id

  const doneItems = items
    .filter(i => matchesScope(i) && i.status === "done")
    .slice()
    .sort((a, b) => {
      const aT = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bT = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bT - aT
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
    <div className={styles.list}>
      {doneItems.map(item => {
        const isEditing = editing?.id === item.id
        const isDeleting = deleting?.id === item.id
        const completedLabel = item.completed_at
          ? new Date(item.completed_at).toLocaleDateString()
          : ""

        if (isEditing) {
          return (
            <Card key={item.id} asChild>
              <article>
                <Card.Block>
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
                </Card.Block>
              </article>
            </Card>
          )
        }

        return (
          <Card key={item.id} asChild>
            <article>
              <Card.Block className={styles.row} data-size="sm">
                <Paragraph className={styles.date} data-size="sm">
                  {completedLabel}
                </Paragraph>
                <Paragraph className={styles.description} data-size="sm">
                  {item.description}
                </Paragraph>
                <Paragraph className={styles.instructions} data-size="sm">
                  {item.instructions ?? ""}
                </Paragraph>
                <div className={styles.actions}>
                  <Button
                    variant="tertiary"
                    data-size="sm"
                    disabled={pending}
                    onClick={() => { setEditing({ id: item.id }) }}
                  >
                    Edit
                  </Button>
                  {!isDeleting && (
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      onClick={() => {
                        setDeleting({ id: item.id, typed: "" })
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card.Block>
              {isDeleting && (
                <Card.Block>
                  <div className={styles.confirm}>
                    <Paragraph data-size="sm">
                      Type <code>{item.description}</code> to confirm:
                    </Paragraph>
                    <Textfield
                      aria-label="Type description to confirm deletion"
                      data-size="sm"
                      value={deleting.typed}
                      onChange={e => {
                        setDeleting({ id: item.id, typed: e.target.value })
                      }}
                    />
                    <Button
                      data-color="danger"
                      data-size="sm"
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
                      data-size="sm"
                      disabled={pending}
                      onClick={() => { setDeleting(null) }}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card.Block>
              )}
            </article>
          </Card>
        )
      })}
    </div>
  )
}
