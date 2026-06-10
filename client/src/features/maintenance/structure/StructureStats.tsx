import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Chip, Tabs } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./StructureStats.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import type { MaintenanceScope } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"
import { MaintenanceCard } from "@/features/maintenance/maintenancecard/MaintenanceCard.tsx"
import { Equipment } from "@/features/maintenance/equipment/Equipment.tsx"

type TabValue = "structures" | "infrastructure" | "equipment"

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
  const [structureFilter, setStructureFilter] = useState<Set<number>>(new Set())
  const [infrastructureFilter, setInfrastructureFilter] = useState<Set<number>>(
    new Set(),
  )

  const toggle = (set: Set<number>, id: number): Set<number> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const visibleStructures =
    structureFilter.size === 0
      ? structures
      : structures.filter(b => structureFilter.has(b.id))
  const visibleInfrastructure =
    infrastructureFilter.size === 0
      ? infrastructure
      : infrastructure.filter(p => infrastructureFilter.has(p.id))

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
              <p>{t("No Structures yet.")}</p>
            ) : (
              <div className={styles.wrap}>
                <div
                  className={styles.filter}
                  role="group"
                  aria-label={t("Filter Structures")}
                >
                  {structures.map(b => (
                    <Chip.Checkbox
                      key={b.id}
                      name="structure-filter"
                      value={String(b.id)}
                      checked={structureFilter.has(b.id)}
                      onChange={() => {
                        setStructureFilter(prev => toggle(prev, b.id))
                      }}
                    >
                      {b.name}
                    </Chip.Checkbox>
                  ))}
                </div>
                <div className={styles.cards}>
                  {visibleStructures.map(b => {
                    const scope: MaintenanceScope = {
                      kind: "structure",
                      id: b.id,
                      name: b.name,
                      builtYear: b.built_year,
                    }
                    return <MaintenanceCard key={b.id} scope={scope} />
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="infrastructure" className={styles.panel}>
        {activeTab === "infrastructure" && (
          <section className={styles.section}>
            {infrastructure.length === 0 ? (
              <p>{t("No Infrastructure yet.")}</p>
            ) : (
              <div className={styles.wrap}>
                <div
                  className={styles.filter}
                  role="group"
                  aria-label={t("Filter Infrastructure")}
                >
                  {infrastructure.map(p => (
                    <Chip.Checkbox
                      key={p.id}
                      name="infrastructure-filter"
                      value={String(p.id)}
                      checked={infrastructureFilter.has(p.id)}
                      onChange={() => {
                        setInfrastructureFilter(prev => toggle(prev, p.id))
                      }}
                    >
                      {p.name}
                    </Chip.Checkbox>
                  ))}
                </div>
                <div className={styles.cards}>
                  {visibleInfrastructure.map(p => {
                    const scope: MaintenanceScope = {
                      kind: "infrastructure",
                      id: p.id,
                      name: p.name,
                      builtYear: p.since_year,
                    }
                    return <MaintenanceCard key={p.id} scope={scope} />
                  })}
                </div>
              </div>
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
