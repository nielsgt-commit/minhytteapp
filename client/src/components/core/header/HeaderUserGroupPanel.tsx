import { Avatar, Paragraph} from "@digdir/designsystemet-react"
import { Buildings2Icon } from "@navikt/aksel-icons"
import UserGroupBadge from "./UserGroupBadge.tsx"

export default function HeaderUserGroupPanel() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", alignSelf: "flex-end" }}>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <Paragraph data-variant="short" data-size='xs' style={{ margin: 0 }}>User group</Paragraph>
        <UserGroupBadge />
      </div>
    </div>
  )
}