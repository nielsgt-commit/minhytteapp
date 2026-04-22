import { useState } from "react"
import OrgSwitcher, { organizations } from "./OrgSwitcher"
import styles from "./Header.module.css"

export default function OrgMenu() {
  const [currentOrgId, setCurrentOrgId] = useState(organizations[0].id)
  const currentOrg =
    organizations.find(org => org.id === currentOrgId) ?? organizations[0]

  return (
    <div className={styles.menu}>
      <span>{currentOrg.name}</span>
      <OrgSwitcher value={currentOrgId} onChange={setCurrentOrgId} />
    </div>
  )
}
