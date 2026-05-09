import { ListUsers } from "./ListUsers.tsx"
import { UserGroupsFlow } from "./UserGroupsFlow.tsx"
import { PropertyInvitesPanel } from "./PropertyInvitesPanel.tsx"
import styles from "./UserGroups.module.css"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export function UserGroups() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <p>Select a property to manage its user groups and members.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <div className={styles.groups}>
        <UserGroupsFlow />
      </div>
      <div className={styles.invites}>
        <PropertyInvitesPanel />
      </div>
      <div className={styles.users}>
        <ListUsers />
      </div>
    </section>
  )
}