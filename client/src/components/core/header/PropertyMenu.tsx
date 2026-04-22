import { useState } from "react"
import PropertySwitcher, { properties } from "./PropertySwitcher.tsx"
import styles from "./Header.module.css"

export default function PropertyMenu() {
  const [currentOrgId, setCurrentOrgId] = useState(properties[0].id)
  const currentOrg =
    properties.find(org => org.id === currentOrgId) ?? properties[0]

  return (
    <div className={styles.menu}>
      <span>{currentOrg.name}</span>
      <PropertySwitcher value={currentOrgId} onChange={setCurrentOrgId} />
    </div>
  )
}
