import { useSelectedPropertyId } from "@/selection/useSelection"
import { Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useCanEdit } from "@/hooks/useCanEdit"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { InvitesPanel } from "./invites/InvitesPanel.tsx"
import section from "@/features/property/managePropertySection.module.css"

export function Invites() {
  const { t } = useTranslation("usergroups")
  const selectedPropertyId = useSelectedPropertyId()
  const canEdit = useCanEdit()

  if (selectedPropertyId == null) {
    return (
      <Paragraph>{t("Select a property to manage its invites.")}</Paragraph>
    )
  }

  return (
    <div className={section.column}>
      <QueryBoundary>
        <InvitesPanel canEdit={canEdit} />
      </QueryBoundary>
    </div>
  )
}
