import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import styles from "./MaintenanceHistory.module.css"
import { InspectionCard } from "@/features/maintenance/InspectionCard.tsx"
import type { MaintenanceScope } from "@/features/maintenance/MaintenanceCard.tsx"
import { MaintenanceHistoryEditForm } from "@/features/maintenance/MaintenanceHistoryEditForm.tsx"
import { MaintenanceHistoryItemView } from "@/features/maintenance/MaintenanceHistoryItemView.tsx"
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
  const { data: inspections = [] } = useQuery(
    trpc.inspection.listForProperty.queryOptions(
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

  const matchesScope = (i: (typeof items)[number]) =>
    scope.kind === "structure"
      ? i.structure_id === scope.id
      : i.infrastructure_id === scope.id

  const doneItems = items
    .filter(i => matchesScope(i) && i.status === "done")
    .slice()
    .sort((a, b) => {
      const aT = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bT = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bT - aT
    })

  const scopedInspections = inspections.filter(i => {
    if (i.completed_at == null) return false
    return scope.kind === "structure"
      ? i.structure_id === scope.id
      : i.infrastructure_id === scope.id
  })

  type HistoryEntry =
    | { kind: "maintenance"; t: number; item: (typeof doneItems)[number] }
    | { kind: "inspection"; t: number; item: (typeof scopedInspections)[number] }

  const entries: HistoryEntry[] = [
    ...doneItems.map(item => ({
      kind: "maintenance" as const,
      t: item.completed_at ? new Date(item.completed_at).getTime() : 0,
      item,
    })),
    ...scopedInspections.map(item => ({
      kind: "inspection" as const,
      t: item.completed_at ? new Date(item.completed_at).getTime() : 0,
      item,
    })),
  ].sort((a, b) => b.t - a.t)

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

  if (lastError) {
    return <p role="alert">Error: {lastError.message}</p>
  }

  if (entries.length === 0) {
    return <p>No completed maintenance yet.</p>
  }

  return (
    <div className={styles.list}>
      {entries.map(entry => {
        if (entry.kind === "inspection") {
          return <InspectionCard key={`i-${String(entry.item.id)}`} inspection={entry.item} />
        }
        const item = entry.item
        const isEditing = editing?.id === item.id
        const isDeleting = deleting?.id === item.id

        if (isEditing) {
          return (
            <MaintenanceHistoryEditForm
              key={item.id}
              item={item}
              pending={pending}
              onSubmit={handleEditSubmit(item)}
              onCancel={() => { setEditing(null) }}
            />
          )
        }

        return (
          <MaintenanceHistoryItemView
            key={item.id}
            item={item}
            pending={pending}
            isDeleting={isDeleting}
            deletingTyped={deleting?.typed ?? ""}
            onStartEdit={() => { setEditing({ id: item.id }) }}
            onStartDelete={() => { setDeleting({ id: item.id, typed: "" }) }}
            onChangeTyped={value => {
              setDeleting({ id: item.id, typed: value })
            }}
            onConfirmDelete={() => {
              deleteMutation.mutate(
                { id: item.id },
                { onSuccess: () => { setDeleting(null) } },
              )
            }}
            onCancelDelete={() => { setDeleting(null) }}
          />
        )
      })}
    </div>
  )
}
