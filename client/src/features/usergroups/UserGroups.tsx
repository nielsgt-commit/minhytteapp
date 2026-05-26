import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useTranslation } from "react-i18next"
import { useCanEdit } from "@/hooks/useCanEdit"
import { UserGroupsFlow } from "./UserGroupsFlow.tsx"

export function UserGroups() {
  const { t } = useTranslation("usergroups")
  const selectedPropertyId = useSelectedPropertyId()
  const canEdit = useCanEdit()

  if (selectedPropertyId == null) {
    return (
      <p>{t("Select a property to manage its user groups and members.")}</p>
    )
  }

  return (
    <section>
      <UserGroupsFlow canEdit={canEdit} />
    </section>
  )
}
