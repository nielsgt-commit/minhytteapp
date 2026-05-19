import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { ListUsers } from "./users/ListUsers.tsx"
import { UserGroupsFlow } from "./UserGroupsFlow.tsx"
import { PropertyInvitesPanel } from "./invites/PropertyInvitesPanel.tsx"
import styles from "./UserGroups.module.css"

export function UserGroups() {
  const selectedPropertyId = useSelectedPropertyId()

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