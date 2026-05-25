import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useTranslation } from "react-i18next"
import { useCanEdit } from "@/hooks/useCanEdit"
import { ListUsers } from "./users/ListUsers.tsx"

export function Users() {
  const { t } = useTranslation("usergroups")
  const selectedPropertyId = useSelectedPropertyId()
  const canEdit = useCanEdit()

  if (selectedPropertyId == null) {
    return <p>{t("Select a property to manage its users.")}</p>
  }

  return (
    <section>
      <ListUsers canEdit={canEdit} />
    </section>
  )
}
