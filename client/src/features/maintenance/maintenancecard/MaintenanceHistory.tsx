import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import styles from "./MaintenanceHistory.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { InspectionCard } from "@/features/maintenance/inspectionflow/InspectionCard.tsx"
import type { MaintenanceScope } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"
import {
  MaintenanceHistoryEditForm,
  type MaintenanceHistoryEditValues,
} from "@/features/maintenance/maintenancecard/MaintenanceHistoryEditForm.tsx"
import { MaintenanceHistoryItemViewPT } from "@/features/maintenance/maintenancecard/MaintenanceHistoryItemViewPT.tsx"
import { cycleSeverity } from "@/features/maintenance/severity/SeverityTag.tsx"

type EditingState = { id: number } | null
type DeletingState = { id: number; typed: string } | null

export function MaintenanceHistory({ scope }: { scope: MaintenanceScope }) {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()

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

  const maintenanceKeys = [trpc.maintenance.pathKey()]
  const updateMutation = useMutationWithInvalidation(
    trpc.maintenance.update.mutationOptions(),
    maintenanceKeys,
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.maintenance.delete.mutationOptions(),
    maintenanceKeys,
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
      if (bT !== aT) return bT - aT
      return b.id - a.id
    })

  const scopedInspections = inspections.filter(i => {
    if (i.completed_at == null) return false
    return scope.kind === "structure"
      ? i.structure_id === scope.id
      : i.infrastructure_id === scope.id
  })

  type HistoryEntry =
    | { kind: "maintenance"; t: number; item: (typeof doneItems)[number] }
    | {
        kind: "inspection"
        t: number
        item: (typeof scopedInspections)[number]
      }

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

  const cycleItemSeverity = (item: (typeof doneItems)[number]) => {
    updateMutation.mutate({
      id: item.id,
      description: item.description,
      instructions_pt: item.instructions_pt,
      added_by: item.added_by,
      assigned_to_id: item.assigned_to_id ?? undefined,
      structure_id: item.structure_id ?? undefined,
      infrastructure_id: item.infrastructure_id ?? undefined,
      equipment_id: item.equipment_id ?? undefined,
      category: item.category,
      severity: cycleSeverity(item.severity),
      status: item.status,
      recurrence: item.recurrence,
    })
  }

  const handleEditSubmit =
    (item: (typeof doneItems)[number]) =>
    (values: MaintenanceHistoryEditValues) => {
      updateMutation.mutate(
        {
          id: item.id,
          description: values.description,
          instructions_pt: values.instructions_pt,
          added_by: item.added_by,
          assigned_to_id: item.assigned_to_id ?? undefined,
          structure_id: item.structure_id ?? undefined,
          infrastructure_id: item.infrastructure_id ?? undefined,
          equipment_id: item.equipment_id ?? undefined,
          category: item.category,
          severity: item.severity,
          status: item.status,
          recurrence: item.recurrence,
          completed_at: values.completed_at,
        },
        {
          onSuccess: () => {
            setEditing(null)
          },
        },
      )
    }

  if (lastError) {
    return (
      <p role="alert">
        {t("Error: {{message}}", { message: lastError.message })}
      </p>
    )
  }

  if (entries.length === 0) {
    return <p>{t("No completed maintenance yet.")}</p>
  }

  return (
    <div className={styles.list}>
      {entries.map(entry => {
        if (entry.kind === "inspection") {
          return (
            <InspectionCard
              key={`i-${String(entry.item.id)}`}
              inspection={entry.item}
            />
          )
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
              onCancel={() => {
                setEditing(null)
              }}
            />
          )
        }

        return (
          <MaintenanceHistoryItemViewPT
            key={item.id}
            item={item}
            pending={pending}
            isDeleting={isDeleting}
            deletingTyped={deleting?.typed ?? ""}
            onStartEdit={() => {
              setEditing({ id: item.id })
            }}
            onStartDelete={() => {
              setDeleting({ id: item.id, typed: "" })
            }}
            onChangeTyped={value => {
              setDeleting({ id: item.id, typed: value })
            }}
            onConfirmDelete={() => {
              deleteMutation.mutate(
                { id: item.id },
                {
                  onSuccess: () => {
                    setDeleting(null)
                  },
                },
              )
            }}
            onCancelDelete={() => {
              setDeleting(null)
            }}
            onCycleSeverity={() => {
              cycleItemSeverity(item)
            }}
          />
        )
      })}
    </div>
  )
}
