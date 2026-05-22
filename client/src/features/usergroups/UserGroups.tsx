import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Checkbox } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { ListUsers } from "./users/ListUsers.tsx"
import { UserGroupsFlow } from "./UserGroupsFlow.tsx"
import { InvitesPanel } from "./invites/InvitesPanel.tsx"
import styles from "./UserGroups.module.css"

export function UserGroups() {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const [editMode, setEditMode] = useState(false)
  const canEdit = me.is_admin || me.is_head

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <p>{t("Select a property to manage its user groups and members.")}</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      {canEdit && (
        <div className={styles.header}>
          <Checkbox
            label={t("Edit mode")}
            checked={editMode}
            onChange={e => { setEditMode(e.currentTarget.checked) }}
          />
        </div>
      )}
      <div className={styles.groups}>
        <UserGroupsFlow editMode={canEdit && editMode} />
      </div>
      <div className={styles.invites}>
        <InvitesPanel editMode={canEdit && editMode} />
      </div>
      <div className={styles.users}>
        <ListUsers editMode={canEdit && editMode} />
      </div>
    </section>
  )
}