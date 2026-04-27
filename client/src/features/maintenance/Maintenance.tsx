import { useSuspenseQuery } from "@tanstack/react-query"
import styles from "./Maintenance.module.css"
import { MaintenanceTestForm } from "@/features/maintenance/testform/MaintenanceTestForm.tsx"
import { BuildingStats } from "@/features/maintenance/BuildingStats.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { AssignedTasks } from "@/features/maintenance/AssignedTasks.tsx"

export function Maintenance() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )

  const propertyBuildings =
    selectedPropertyId != null
      ? buildings.filter(b => b.property_id === selectedPropertyId)
      : []

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Maintenance</h2>
        <p>Add or select a property to log issues, plan upkeep, and track work across buildings.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Maintenance</h2>
      <div className={styles.content}>
        {propertyBuildings.length === 0 ? (
          <p>No buildings for the selected property. Go to Manage Property</p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "flex-start",
            }}
          >
            {propertyBuildings.map(b => (
              <div key={b.id} style={{ flex: "1 1 0", minWidth: 0 }}>
                <BuildingStats buildingId={b.id} buildingName={b.name} />
              </div>
            ))}
          </div>
        )}
        <MaintenanceTestForm />

        <AssignedTasks />
      </div>
    </section>
  )
}