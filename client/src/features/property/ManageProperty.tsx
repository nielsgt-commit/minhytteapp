import { Suspense, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Divider } from "@digdir/designsystemet-react"
import PropertyInfo from "@/features/property/propertyinfo/PropertyInfo.tsx"
import PropertyContacts from "@/features/property/propertyinfo/PropertyContacts.tsx"
import styles from "./ManageProperty.module.css"
import { ListPropertyBuildings } from "@/features/property/testform/ListPropertyBuildings.tsx"
import { DangerZone } from "@/features/property/dangerzone/DangerZone.tsx"
import { PropertyOwnersPanel } from "@/features/property/owners/PropertyOwnersPanel.tsx"
import { PlacesPanel } from "@/features/property/places/PlacesPanel.tsx"
import { EquipmentPanel } from "@/features/property/equipment/EquipmentPanel.tsx"
import { PropertyRegister } from "@/features/property/register/PropertyRegister.tsx"
import {
  PropertyManagerFilter,
  type PropertyPanel,
} from "@/features/property/PropertyManagerFilter.tsx"
import PropertyStats from "@/features/dashboard/propertystats/PropertyStats"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function ManageProperty() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const [activePanel, setActivePanel] = useState<PropertyPanel>("info")

  const selectedProperty =
    selectedPropertyId != null
      ? properties.find(p => p.id === selectedPropertyId)
      : undefined

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
      <h1 className={styles.title}>Manage Property</h1>
      <div className={styles.summaries}>
        <Suspense fallback={<p>Loading…</p>}>
          <PropertyStats />
        </Suspense>
      </div>

      <PropertyManagerFilter value={activePanel} onChange={setActivePanel} />

      {activePanel === "info" && <PropertyInfo />}
      {activePanel === "buildings" && <ListPropertyBuildings />}
      {activePanel === "places" && selectedProperty && (
        <PlacesPanel
          propertyId={selectedProperty.id}
          propertyName={selectedProperty.name}
        />
      )}
      {activePanel === "inventory" && selectedProperty && (
        <EquipmentPanel
          propertyId={selectedProperty.id}
          propertyName={selectedProperty.name}
        />
      )}
      {activePanel === "contacts" && <PropertyContacts />}
      {activePanel === "ownership" && <PropertyOwnersPanel />}
      {activePanel === "register" && <PropertyRegister />}

      <Divider />
      <DangerZone />
    </section>
  )
}
