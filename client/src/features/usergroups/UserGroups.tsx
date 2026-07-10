import { useSelectedPropertyId } from "@/selection/useSelection"
import { Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useCanEdit } from "@/hooks/useCanEdit"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { UserGroupsFlow } from "./UserGroupsFlow.tsx"
import section from "@/components/layouts/manageSection.module.css"

export function UserGroups() {
  const { t } = useTranslation("usergroups")
  const selectedPropertyId = useSelectedPropertyId()
  const canEdit = useCanEdit()

  if (selectedPropertyId == null) {
    return (
      <Paragraph>
        {t("Select a property to manage its user groups and members.")}
      </Paragraph>
    )
  }

  return (
    <div className={section.column}>
      <QueryBoundary>
        <UserGroupsFlow canEdit={canEdit} />
      </QueryBoundary>
    </div>
  )
}
