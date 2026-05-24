import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useTranslation } from "react-i18next"
import { useCanEdit } from "@/hooks/useCanEdit"
import { InvitesPanel } from "./invites/InvitesPanel.tsx"

export function Invites() {
  const { t } = useTranslation("usergroups")
  const selectedPropertyId = useSelectedPropertyId()
  const canEdit = useCanEdit()

  if (selectedPropertyId == null) {
    return <p>{t("Select a property to manage its invites.")}</p>
  }

  return (
    <section>
      <InvitesPanel canEdit={canEdit} />
    </section>
  )
}
