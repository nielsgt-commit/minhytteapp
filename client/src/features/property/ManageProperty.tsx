import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Outlet, useLocation } from "@tanstack/react-router"
import { Card } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ManageProperty.module.css"
import { SideNav } from "@/components/shared/SideNav"
import { GroupTabs } from "@/components/shared/GroupTabs"
import { useTRPC } from "@/trpc/trpc.ts"

const BANNERS = new Map<string, { title: string; description: string }>([
  ["/manageproperty/info", {
    title: "Info",
    description: "Name, address, link, and basic facts about the property.",
  }],
  ["/manageproperty/contacts", {
    title: "Contacts",
    description: "People to call for the property — caretakers, neighbours, service providers.",
  }],
  ["/manageproperty/ownership", {
    title: "Ownership",
    description: "Who owns what share of the property.",
  }],
  ["/manageproperty/usergroups", {
    title: "User groups",
    description: "Group users together to share access, costs, or bookings.",
  }],
  ["/manageproperty/structures", {
    title: "Structures",
    description: "Buildings on the property and the rooms inside them.",
  }],
  ["/manageproperty/infrastructure", {
    title: "Infrastructure",
    description: "Water, power, heating, network, and other systems serving the property.",
  }],
  ["/manageproperty/equipment", {
    title: "Equipment",
    description: "Tools, appliances, and gear kept at the property.",
  }],
  ["/manageproperty/split-policy", {
    title: "Split policy",
    description: "Rules for how shared costs are split across owners and users.",
  }],
  ["/manageproperty/settings", {
    title: "Settings",
    description: "Per-property preferences and danger zone actions.",
  }],
])

function RouteBanner({ pathname }: { pathname: string }) {
  const { t } = useTranslation("property")
  const td = t as (key: string) => string
  const banner = BANNERS.get(pathname)
  if (!banner) return null
  return (
    <Card asChild>
      <header>
        <h2>{td(banner.title)}</h2>
        <p>{td(banner.description)}</p>
      </header>
    </Card>
  )
}

const DESKTOP_GROUPS = [
  { label: "Identity", items: [
    { to: "/manageproperty/info", label: "Info" },
    { to: "/manageproperty/contacts", label: "Contacts" },
    { to: "/manageproperty/ownership", label: "Ownership" },
    { to: "/manageproperty/usergroups", label: "User groups" },
  ]},
  { label: "Property", items: [
    { to: "/manageproperty/structures", label: "Structures" },
    { to: "/manageproperty/infrastructure", label: "Infrastructure" },
    { to: "/manageproperty/equipment", label: "Equipment" },
  ]},
  { label: "Admin", items: [
    { to: "/manageproperty/split-policy", label: "Split policy" },
    { to: "/manageproperty/settings", label: "Settings" },
  ]},
] as const

const MOBILE_GROUPS = [
  { label: "Info", items: [
    { to: "/manageproperty/info", label: "Info" },
  ]},
  { label: "Property", items: [
    { to: "/manageproperty/structures", label: "Structures" },
    { to: "/manageproperty/infrastructure", label: "Infrastructure" },
    { to: "/manageproperty/equipment", label: "Equipment" },
  ]},
  { label: "Identity", items: [
    { to: "/manageproperty/contacts", label: "Contacts" },
    { to: "/manageproperty/ownership", label: "Ownership" },
    { to: "/manageproperty/usergroups", label: "User groups" },
  ]},
  { label: "Admin", items: [
    { to: "/manageproperty/split-policy", label: "Split policy" },
    { to: "/manageproperty/settings", label: "Settings" },
  ]},
] as const

export function ManageProperty() {
  const { t } = useTranslation("property")
  const td = t as (key: string) => string
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { pathname } = useLocation()
  useSuspenseQuery(trpc.property.list.queryOptions())

  const translateGroups = <G extends { label: string; items: readonly { to: string; label: string }[] }>(
    groups: readonly G[],
  ) => groups.map(g => ({
    label: td(g.label),
    items: g.items.map(i => ({ to: i.to, label: td(i.label) })),
  }))

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t("Manage Property")}</h1>
        <p>{t("Add or select a property to edit its details, structures, owners, and invites.")}</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t("Manage Property")}</h1>

      <div className={styles.layout}>
        <div className={styles.desktopNav}>
          <SideNav ariaLabel={t("Property sections")} groups={translateGroups(DESKTOP_GROUPS)} />
        </div>
        <div className={styles.mobileNav}>
          <GroupTabs groups={translateGroups(MOBILE_GROUPS)} />
        </div>
        <div className={styles.content}>
          <RouteBanner pathname={pathname} />
          <Suspense fallback={<p>{t("Loading…")}</p>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
