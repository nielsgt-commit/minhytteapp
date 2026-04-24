import { ListUsers } from "./ListUsers.tsx"
import { UserGroupsFlow } from "./UserGroupsFlow.tsx"
import styles from "./UserGroups.module.css"

export function UserGroups() {
  return (
    <section className={styles.page}>
      <div className={styles.groups}>
        <UserGroupsFlow />
      </div>
      <div className={styles.users}>
        <ListUsers />
      </div>
    </section>
  )
}
