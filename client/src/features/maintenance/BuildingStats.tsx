import { type ReactNode, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Chip, Heading, Tabs } from "@digdir/designsystemet-react"
import styles from "./BuildingStats.module.css"
import { Equipment } from "@/features/maintenance/Equipment.tsx"
import {
  MaintenanceCard,
  type MaintenanceScope,
} from "@/features/maintenance/MaintenanceCard.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

type TabValue = "buildings" | "places" | "inventory"

function CategoryFrame({
  isMobile,
  title,
  children,
}: {
  isMobile: boolean
  title: string
  children: ReactNode
}) {
  if (isMobile) return <>{children}</>
  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={3} data-size="xs">{title}</Heading>
        </Card.Block>
        <Card.Block>{children}</Card.Block>
      </section>
    </Card>
  )
}

export function BuildingStats() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const isMobile = useIsMobile()

  const { data: buildings } = useSuspenseQuery(
    trpc.building.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: places } = useSuspenseQuery(
    trpc.place.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const [activeTab, setActiveTab] = useState<TabValue>("buildings")
  const [buildingFilter, setBuildingFilter] = useState<Set<number>>(new Set())
  const [placeFilter, setPlaceFilter] = useState<Set<number>>(new Set())

  const toggle = (set: Set<number>, id: number): Set<number> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const visibleBuildings =
    buildingFilter.size === 0
      ? buildings
      : buildings.filter(b => buildingFilter.has(b.id))
  const visiblePlaces =
    placeFilter.size === 0 ? places : places.filter(p => placeFilter.has(p.id))

  return (
    <Tabs
      value={activeTab}
      onChange={value => {
        setActiveTab(value as TabValue)
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="buildings">Buildings</Tabs.Tab>
        <Tabs.Tab value="places">Places</Tabs.Tab>
        <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="buildings">
        {activeTab === "buildings" && (
          <CategoryFrame isMobile={isMobile} title="Buildings">
            {buildings.length === 0 ? (
              <p>No buildings yet.</p>
            ) : (
              <div className={styles.wrap}>
                <div
                  className={styles.filter}
                  role="group"
                  aria-label="Filter buildings"
                >
                  {buildings.map(b => (
                    <Chip.Checkbox
                      key={b.id}
                      name="building-filter"
                      value={String(b.id)}
                      checked={buildingFilter.has(b.id)}
                      onChange={() => {
                        setBuildingFilter(prev => toggle(prev, b.id))
                      }}
                    >
                      {b.name}
                    </Chip.Checkbox>
                  ))}
                </div>
                <div className={styles.cards}>
                  {visibleBuildings.map(b => {
                    const scope: MaintenanceScope = {
                      kind: "building",
                      id: b.id,
                      name: b.name,
                    }
                    return <MaintenanceCard key={b.id} scope={scope} />
                  })}
                </div>
              </div>
            )}
          </CategoryFrame>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="places">
        {activeTab === "places" && (
          <CategoryFrame isMobile={isMobile} title="Places">
            {places.length === 0 ? (
              <p>No places yet.</p>
            ) : (
              <div className={styles.wrap}>
                <div
                  className={styles.filter}
                  role="group"
                  aria-label="Filter places"
                >
                  {places.map(p => (
                    <Chip.Checkbox
                      key={p.id}
                      name="place-filter"
                      value={String(p.id)}
                      checked={placeFilter.has(p.id)}
                      onChange={() => {
                        setPlaceFilter(prev => toggle(prev, p.id))
                      }}
                    >
                      {p.name}
                    </Chip.Checkbox>
                  ))}
                </div>
                <div className={styles.cards}>
                  {visiblePlaces.map(p => {
                    const scope: MaintenanceScope = {
                      kind: "place",
                      id: p.id,
                      name: p.name,
                    }
                    return <MaintenanceCard key={p.id} scope={scope} />
                  })}
                </div>
              </div>
            )}
          </CategoryFrame>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="inventory">
        {activeTab === "inventory" && <Equipment />}
      </Tabs.Panel>
    </Tabs>
  )
}
