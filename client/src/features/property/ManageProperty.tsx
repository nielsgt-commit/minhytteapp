import PropertyInfo from "@/features/property/propertyinfo/PropertyInfo.tsx"
import styles from "./ManageProperty.module.css"
import { AddBuildingFlow } from "@/features/property/testform/AddBuildingFlow.tsx"
import { ListPropertyBuildings } from "@/features/property/testform/ListPropertyBuildings.tsx"
import { DangerZone } from "@/features/property/dangerzone/DangerZone.tsx"
import { PropertyOwnersPanel } from "@/features/property/owners/PropertyOwnersPanel.tsx"

export function ManageProperty() {

  return (
    <>
      <section className={styles.page}>
       <h1 className={styles.title}>  Manage Property </h1>
        <div className={styles.details}>
          <PropertyInfo />
        </div>
        <div className={styles.buildings}>
        <ListPropertyBuildings />
        </div>

        <div className={styles.addbuilding}>
          <AddBuildingFlow />
        </div>

        <div className={styles.owners}>
          <PropertyOwnersPanel />
        </div>

        <hr className={styles.divider} />

        <div className={styles.dangerzone}>
          <DangerZone />
        </div>
      </section>
    </>

  )
}