import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Chip, Tabs } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./StructureStats.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import type { MaintenanceScope } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"
import { MaintenanceCard } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"
import { Equipment } from "@/features/maintenance/equipment/Equipment.tsx"
import { CardGallery } from "@/components/shared/CardGallery/CardGallery.tsx"

type TabValue = "structures" | "infrastructure" | "equipment"

type StructureCategory = "habitable" | "non_habitable"

// Habitable buildings are the ones with bedrooms; keep this order in the filter.
const STRUCTURE_CATEGORY_ORDER: StructureCategory[] = [
  "habitable",
  "non_habitable",
]

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function StructureStats() {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()

  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: infrastructure } = useSuspenseQuery(
    trpc.infrastructure.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const [activeTab, setActiveTab] = useState<TabValue>("structures")
  const [structureCategoryFilter, setStructureCategoryFilter] = useState<
    Set<StructureCategory>
  >(new Set())

  const categoryLabels: Record<StructureCategory, string> = {
    habitable: t("Habitable"),
    non_habitable: t("Non-habitable"),
  }

  // Only offer the building types actually present on this property.
  const presentCategories = STRUCTURE_CATEGORY_ORDER.filter(c =>
    structures.some(b => b.category === c),
  )

  const visibleStructures =
    structureCategoryFilter.size === 0
      ? structures
      : structures.filter(b => structureCategoryFilter.has(b.category))

  return (
    <Tabs
      value={activeTab}
      onChange={value => {
        setActiveTab(value as TabValue)
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="structures">{t("Structures")}</Tabs.Tab>
        <Tabs.Tab value="infrastructure">{t("Infrastructure")}</Tabs.Tab>
        <Tabs.Tab value="equipment">{t("Equipment")}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="structures" className={styles.panel}>
        {activeTab === "structures" && (
          <section className={styles.section}>
            {structures.length === 0 ? (
              <EmptyState title={t("No Structures yet.")} />
            ) : (
              <div className={styles.wrap}>
                {presentCategories.length > 1 && (
                  <div
                    className={styles.filter}
                    role="group"
                    aria-label={t("Filter building types")}
                  >
                    {presentCategories.map(c => (
                      <Chip.Checkbox
                        key={c}
                        name="structure-category-filter"
                        value={c}
                        checked={structureCategoryFilter.has(c)}
                        onChange={() => {
                          setStructureCategoryFilter(prev => toggle(prev, c))
                        }}
                      >
                        {categoryLabels[c]}
                      </Chip.Checkbox>
                    ))}
                  </div>
                )}
                <CardGallery ariaLabel={t("Browse Structures")}>
                  {visibleStructures.map(b => {
                    const scope: MaintenanceScope = {
                      kind: "structure",
                      id: b.id,
                      name: b.name,
                      builtYear: b.built_year,
                    }
                    return <MaintenanceCard key={b.id} scope={scope} />
                  })}
                </CardGallery>
              </div>
            )}
          </section>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="infrastructure" className={styles.panel}>
        {activeTab === "infrastructure" && (
          <section className={styles.section}>
            {infrastructure.length === 0 ? (
              <EmptyState title={t("No Infrastructure yet.")} />
            ) : (
              // Filter group intentionally unmounted for now — to be reworked.
              <CardGallery ariaLabel={t("Browse Infrastructure")}>
                {infrastructure.map(p => {
                  const scope: MaintenanceScope = {
                    kind: "infrastructure",
                    id: p.id,
                    name: p.name,
                    builtYear: p.since_year,
                  }
                  return <MaintenanceCard key={p.id} scope={scope} />
                })}
              </CardGallery>
            )}
          </section>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="equipment" className={styles.panel}>
        {activeTab === "equipment" && <Equipment />}
      </Tabs.Panel>
    </Tabs>
  )
}
