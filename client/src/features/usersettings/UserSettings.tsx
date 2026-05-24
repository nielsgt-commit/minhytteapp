import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { ProfileSection } from "./ProfileSection"
import { ChildrenSection } from "./ChildrenSection"
import { Heading } from "@digdir/designsystemet-react"

export function UserSettings() {
  const { t } = useTranslation("usersettings")
  const trpc = useTRPC()

  const { data: me } = useQuery(trpc.user.me.queryOptions())

  if (!me) return <p>{t("Loading…")}</p>

  return (
    <section>
      <Heading level={2}>{t("User settings")}</Heading>
      <ProfileSection me={me} />
      <ChildrenSection />
    </section>
  )
}
