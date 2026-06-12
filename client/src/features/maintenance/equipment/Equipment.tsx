import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import styles from "./Equipment.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import type { EquipmentHistoryEntryData } from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import type { ModalState } from "@/features/maintenance/equipment/EquipmentCard.tsx"
import { EquipmentCard } from "@/features/maintenance/equipment/EquipmentCard.tsx"

export function Equipment() {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()

  const { data: equipment = [] } = useQuery(
    trpc.equipment.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
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

  const [modalState, setModalState] = useState<ModalState>({ kind: "none" })

  if (selectedPropertyId == null) {
    return (
      <section>
        <EmptyState title={t("Select a property to see its equipment.")} />
      </section>
    )
  }

  const sortedEquipment = equipment
    .slice()
    .sort((a, b) => Temporal.Instant.compare(b.created_at, a.created_at))

  const body =
    sortedEquipment.length === 0 ? (
      <EmptyState title={t("No equipment registered for this property yet.")} />
    ) : (
      <div className={styles.list}>
        {sortedEquipment.map(item => {
          const itemMaintenance = maintenanceItems
            .filter(m => m.equipment_id === item.id && m.status === "done")
            .slice()
            .sort((a, b) => {
              const aT = a.completed_at?.epochMilliseconds ?? 0
              const bT = b.completed_at?.epochMilliseconds ?? 0
              return bT - aT
            })
          const itemInspections = inspections.filter(
            i => i.equipment_id === item.id && i.completed_at != null,
          )
          const historyEntries: EquipmentHistoryEntryData[] = [
            ...itemMaintenance.map(m => ({
              kind: "maintenance" as const,
              t: m.completed_at?.epochMilliseconds ?? 0,
              m,
            })),
            ...itemInspections.map(i => ({
              kind: "inspection" as const,
              t: i.completed_at?.epochMilliseconds ?? 0,
              i,
            })),
          ].sort((a, b) => b.t - a.t)
          return (
            <EquipmentCard
              key={item.id}
              item={item}
              historyEntries={historyEntries}
              modalState={modalState}
              setModalState={setModalState}
            />
          )
        })}
      </div>
    )

  return <section>{body}</section>
}
