import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { ProfileSection } from "./ProfileSection"
import { ChildrenSection } from "./ChildrenSection"
import { PageHeader } from "@/components/shared/PageHeader"
import type { PageHelpContent } from "@/components/shared/PageHelp"

export function UserSettings() {
  const { t } = useTranslation("usersettings")
  const trpc = useTRPC()

  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const help: PageHelpContent = {
    intro: t(
      "User settings is where you manage your own profile and the children you bring along. This is personal to you and stays the same no matter which cabin you're looking at: your display name, your birthday, and the children under 13 who don't have their own login. Whether you act as a household head is set separately for each cabin.",
    ),
    connections: t(
      "These settings are about you, unlike the per-cabin settings under Manage Property, which only change one cabin. Your display name shows up to everyone in bookings and member lists, so pick something others will recognise. The children you add here can be included when you set up a trip under Plan stay.",
    ),
  }

  if (!me) return <p>{t("Loading…")}</p>

  return (
    <section>
      <PageHeader title={t("User settings")} help={help} />
      <ProfileSection me={me} />
      <ChildrenSection />
    </section>
  )
}
