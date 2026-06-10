import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useCanEdit } from "@/hooks/useCanEdit"
import { ListUsers } from "./users/ListUsers.tsx"
import section from "@/features/property/managePropertySection.module.css"

export function Users() {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const canEdit = useCanEdit()
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )

  if (selectedPropertyId == null) {
    return <Paragraph>{t("Select a property to manage its users.")}</Paragraph>
  }

  const propertyName =
    properties.find(p => p.id === selectedPropertyId)?.name ?? ""

  return (
    <div className={section.column}>
      <ListUsers canEdit={canEdit} propertyName={propertyName} />
    </div>
  )
}
