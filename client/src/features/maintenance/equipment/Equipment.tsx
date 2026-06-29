import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Chip } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import styles from "./Equipment.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import type { EquipmentHistoryEntryData } from "@/features/maintenance/equipment/EquipmentHistoryEntry.tsx"
import type { ModalState } from "@/features/maintenance/equipment/EquipmentCard.tsx"
import { EquipmentCard } from "@/features/maintenance/equipment/EquipmentCard.tsx"
import { CardGallery } from "@/components/shared/CardGallery/CardGallery.tsx"

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
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())

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

  // Distinct categories present on this property, for the (WIP) filter group.
  const categories = Array.from(
    new Set(
      sortedEquipment
        .map(e => e.category)
        .filter((c): c is string => Boolean(c)),
    ),
  ).sort((a, b) => a.localeCompare(b))

  const toggleCategory = (value: string) => {
    setCategoryFilter(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const visibleEquipment =
    categoryFilter.size === 0
      ? sortedEquipment
      : sortedEquipment.filter(
          e => e.category != null && categoryFilter.has(e.category),
        )

  const body =
    sortedEquipment.length === 0 ? (
      <EmptyState title={t("No equipment registered for this property yet.")} />
    ) : (
      <div className={styles.wrap}>
        {categories.length > 0 && (
          <div
            className={styles.filter}
            role="group"
            aria-label={t("Filter categories")}
          >
            {categories.map(c => (
              <Chip.Checkbox
                key={c}
                name="equipment-category-filter"
                value={c}
                checked={categoryFilter.has(c)}
                onChange={() => {
                  toggleCategory(c)
                }}
              >
                {c}
              </Chip.Checkbox>
            ))}
          </div>
        )}
        <CardGallery ariaLabel={t("Browse equipment")}>
          {visibleEquipment.map(item => {
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
        </CardGallery>
      </div>
    )

  return <section>{body}</section>
}
