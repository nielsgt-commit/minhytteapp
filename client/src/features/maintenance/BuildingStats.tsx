import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Chip, Heading } from "@digdir/designsystemet-react"
import styles from "./BuildingStats.module.css"
import { Equipment } from "@/features/maintenance/Equipment.tsx"
import {
  MaintenanceCard,
  type MaintenanceScope,
} from "@/features/maintenance/MaintenanceCard.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type Selection =
  | { kind: "building"; id: number }
  | { kind: "place"; id: number }
  | { kind: "inventory" }

export function BuildingStats() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

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

  const [selection, setSelection] = useState<Selection | null>(null)

  const resolveSelection = (): Selection => {
    if (selection != null) {
      if (
        selection.kind === "building"
        && buildings.some(b => b.id === selection.id)
      ) {
        return selection
      }
      if (
        selection.kind === "place"
        && places.some(p => p.id === selection.id)
      ) {
        return selection
      }
      if (selection.kind === "inventory") return selection
    }
    if (buildings.length > 0) return { kind: "building", id: buildings[0].id }
    if (places.length > 0) return { kind: "place", id: places[0].id }
    return { kind: "inventory" }
  }

  const active = resolveSelection()

  const activeBuilding =
    active.kind === "building"
      ? buildings.find(b => b.id === active.id)
      : undefined
  const activePlace =
    active.kind === "place" ? places.find(p => p.id === active.id) : undefined

  const scope: MaintenanceScope | null = activeBuilding
    ? { kind: "building", id: activeBuilding.id, name: activeBuilding.name }
    : activePlace
      ? { kind: "place", id: activePlace.id, name: activePlace.name }
      : null

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <Heading level={3} data-size="xs">Structures</Heading>
        {buildings.length === 0 ? (
          <p>No structures yet.</p>
        ) : (
          <div
            className={styles.filter}
            role="radiogroup"
            aria-label="Structure"
          >
            {buildings.map(b => (
              <Chip.Radio
                key={b.id}
                name="maintenance-target"
                value={`building-${String(b.id)}`}
                checked={active.kind === "building" && active.id === b.id}
                onChange={() => {
                  setSelection({ kind: "building", id: b.id })
                }}
              >
                {b.name}
              </Chip.Radio>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <Heading level={3} data-size="xs">Infrastructure</Heading>
        {places.length === 0 ? (
          <p>No infrastructure yet.</p>
        ) : (
          <div
            className={styles.filter}
            role="radiogroup"
            aria-label="Infrastructure"
          >
            {places.map(p => (
              <Chip.Radio
                key={p.id}
                name="maintenance-target"
                value={`place-${String(p.id)}`}
                checked={active.kind === "place" && active.id === p.id}
                onChange={() => {
                  setSelection({ kind: "place", id: p.id })
                }}
              >
                {p.name}
              </Chip.Radio>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <Heading level={3} data-size="xs">Inventory</Heading>
        <div
          className={styles.filter}
          role="radiogroup"
          aria-label="Inventory"
        >
          <Chip.Radio
            name="maintenance-target"
            value="inventory"
            checked={active.kind === "inventory"}
            onChange={() => {
              setSelection({ kind: "inventory" })
            }}
          >
            All
          </Chip.Radio>
        </div>
      </section>

      <div className={styles.cards}>
        {scope && <MaintenanceCard scope={scope} />}
        {active.kind === "inventory" && <Equipment />}
      </div>
    </div>
  )
}
