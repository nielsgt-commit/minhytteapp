import { useSuspenseQuery } from "@tanstack/react-query"
import PropertyInfo from "@/features/property/propertyinfo/PropertyInfo.tsx"
import styles from "./ManageProperty.module.css"
import { AddBuildingFlow } from "@/features/property/testform/AddBuildingFlow.tsx"
import { ListPropertyBuildings } from "@/features/property/testform/ListPropertyBuildings.tsx"
import { DangerZone } from "@/features/property/dangerzone/DangerZone.tsx"
import { PropertyOwnersPanel } from "@/features/property/owners/PropertyOwnersPanel.tsx"
import { PropertyInvitesPanel } from "@/features/property/invites/PropertyInvitesPanel.tsx"
import { PlacesPanel } from "@/features/property/places/PlacesPanel.tsx"
import { EquipmentPanel } from "@/features/property/equipment/EquipmentPanel.tsx"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function ManageProperty() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const selectedProperty =
    selectedPropertyId != null
      ? properties.find(p => p.id === selectedPropertyId)
      : undefined

  const propertyBuildings =
    selectedPropertyId != null
      ? buildings.filter(b => b.property_id === selectedPropertyId)
      : []

  const hasBuildings = propertyBuildings.length > 0

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Manage Property</h1>
        <p>Add or select a property to edit its details, buildings, owners, and invites.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>  Manage Property </h1>
      <div className={styles.details}>
        <PropertyInfo />
      </div>
      {hasBuildings && (
        <div className={styles.buildings}>
          <ListPropertyBuildings />
        </div>
      )}

      <div className={styles.addbuilding}>
        <AddBuildingFlow />
      </div>

      <div className={styles.owners}>
        <PropertyOwnersPanel />
      </div>

      <div className={styles.invites}>
        <PropertyInvitesPanel />
      </div>

      {selectedProperty && (
        <div className={styles.places}>
          <PlacesPanel
            propertyId={selectedProperty.id}
            propertyName={selectedProperty.name}
          />
        </div>
      )}

      {selectedProperty && (
        <div className={styles.equipment}>
          <EquipmentPanel
            propertyId={selectedProperty.id}
            propertyName={selectedProperty.name}
          />
        </div>
      )}

      <hr className={styles.divider} />

      <div className={styles.dangerzone}>
        <DangerZone />
      </div>
    </section>
  )
}