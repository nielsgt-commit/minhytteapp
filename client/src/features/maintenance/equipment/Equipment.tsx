import { useSelectedUserId, useSelectedPropertyId } from "@/app/useSelectedIds"
import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Card, Heading } from "@digdir/designsystemet-react"
import styles from "./Equipment.module.css"
import {} from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import type { EquipmentHistoryEntryData } from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import type {
  ModalState} from "@/features/maintenance/equipment/EquipmentCard.tsx";
import {
  EquipmentCard
} from "@/features/maintenance/equipment/EquipmentCard.tsx"

export function Equipment() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const selectedUserId = useSelectedUserId()
  const isMobile = useIsMobile()

  const { data: equipment = [] } = useQuery(
    trpc.equipment.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: structures } = useSuspenseQuery(
    trpc.structure.list.queryOptions(),
  )
  const { data: maintenanceItems = [] } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: inspections = [] } = useQuery(
    trpc.inspection.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const structureNameById = new Map(structures.map(b => [b.id, b.name]))

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.equipment.pathKey(),
    })
    void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
  }

  const [modalState, setModalState] = useState<ModalState>({ kind: "none" })

  const scheduleMutation = useMutation(
    trpc.equipment.scheduleMaintenance.mutationOptions({
      onSuccess: () => {
        setModalState({ kind: "none" })
        invalidate()
      },
    }),
  )

  const handleSubmit = (equipment_id: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (selectedUserId == null) return
      const fd = new FormData(e.currentTarget)
      const rawDescription = fd.get("description")
      const rawDue = fd.get("due_at")
      const description =
        typeof rawDescription === "string" ? rawDescription.trim() : ""
      const dueRaw = typeof rawDue === "string" ? rawDue.trim() : ""
      if (!description) return
      scheduleMutation.mutate({
        equipment_id,
        description,
        added_by: selectedUserId,
        category: "maintenance",
        severity: "minor",
        recurrence: "once",
        due_at: dueRaw ? new Date(dueRaw) : undefined,
      })
    }

  if (selectedPropertyId == null) {
    if (isMobile) {
      return (
        <section>
          <p>Select a property to see its equipment.</p>
        </section>
      )
    }
    return (
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={3} data-size="xs">Equipment</Heading>
            <p>Select a property to see its equipment.</p>
          </Card.Block>
        </section>
      </Card>
    )
  }

  const sortedEquipment = equipment.slice().sort((a, b) => {
    const aT = new Date(a.created_at).getTime()
    const bT = new Date(b.created_at).getTime()
    return bT - aT
  })

  const body = (
    <>
      {scheduleMutation.error && (
        <p role="alert">Error: {scheduleMutation.error.message}</p>
      )}
      {sortedEquipment.length === 0 ? (
        <p>No equipment registered for this property yet.</p>
      ) : (
        <div className={styles.list}>
          {sortedEquipment.map(item => {
            const structureName =
              structureNameById.get(item.structure_id)
              ?? `#${String(item.structure_id)}`
            const itemMaintenance = maintenanceItems
              .filter(m => m.equipment_id === item.id && m.status === "done")
              .slice()
              .sort((a, b) => {
                const aT = a.completed_at
                  ? new Date(a.completed_at).getTime()
                  : 0
                const bT = b.completed_at
                  ? new Date(b.completed_at).getTime()
                  : 0
                return bT - aT
              })
            const itemInspections = inspections.filter(
              i => i.equipment_id === item.id && i.completed_at != null,
            )
            const historyEntries: EquipmentHistoryEntryData[] = [
              ...itemMaintenance.map(m => ({
                kind: "maintenance" as const,
                t: m.completed_at ? new Date(m.completed_at).getTime() : 0,
                m,
              })),
              ...itemInspections.map(i => ({
                kind: "inspection" as const,
                t: i.completed_at ? new Date(i.completed_at).getTime() : 0,
                i,
              })),
            ].sort((a, b) => b.t - a.t)
            return (
              <EquipmentCard
                key={item.id}
                item={item}
                structureName={structureName}
                historyEntries={historyEntries}
                modalState={modalState}
                setModalState={setModalState}
                onScheduleSubmit={handleSubmit}
                schedulePending={scheduleMutation.isPending}
                canSubmitSchedule={selectedUserId != null}
              />
            )
          })}
        </div>
      )}
    </>
  )

  if (isMobile) {
    return <section>{body}</section>
  }

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={3} data-size="xs">Equipment</Heading>
        </Card.Block>
        <Card.Block>{body}</Card.Block>
      </section>
    </Card>
  )
}
