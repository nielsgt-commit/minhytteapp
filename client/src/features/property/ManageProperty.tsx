import { useSelectedPropertyId } from "@/selection/useSelection"
import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Outlet, useLocation } from "@tanstack/react-router"
import { Card, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ManageProperty.module.css"
import { SideNav } from "@/components/shared/SideNav"
import { GroupTabs } from "@/components/shared/GroupTabs"
import { PageHeader } from "@/components/shared/PageHeader"
import type { PageHelpContent } from "@/components/shared/PageHelp"
import { useTRPC } from "@/trpc/trpc.ts"

const BANNERS = new Map<string, { title: string; description: string }>([
  [
    "/administrer/info",
    {
      title: "Info",
      description: "Name, address, link, and basic facts about the property.",
    },
  ],
  [
    "/administrer/kontakter",
    {
      title: "Contacts",
      description:
        "People to call for the property — caretakers, neighbours, service providers.",
    },
  ],
  [
    "/administrer/eierskap",
    {
      title: "Ownership",
      description:
        "Who owns what share of the property. These values don't affect any functionality — they can be used in a split policy if necessary.",
    },
  ],
  [
    "/administrer/brukergrupper",
    {
      title: "User groups",
      description:
        "Group users together to share access, costs, or bookings. A group can own a share of a property and roll up settlements, and can't be deleted while it's in use.",
    },
  ],
  [
    "/administrer/brukere",
    {
      title: "Users",
      description:
        "Everyone with access to this property. Edit user details or remove people — deletion is blocked while a user is still referenced by any group, ownership, booking, or expense.",
    },
  ],
  [
    "/administrer/invitasjoner",
    {
      title: "Invites",
      description:
        "Email addresses allowed to sign in and claim a spot on this property.",
    },
  ],
  [
    "/administrer/bygninger",
    {
      title: "Structures",
      description:
        "Buildings on the property and the rooms inside them. A building can be habitable or not, and you can add rooms where applicable. Rooms and beds count against capacity, and structures can have maintenance tasks assigned to them.",
    },
  ],
  [
    "/administrer/infrastruktur",
    {
      title: "Infrastructure",
      description:
        "Water, power, heating, network, and other systems serving the property.",
    },
  ],
  [
    "/administrer/utstyr",
    {
      title: "Equipment",
      description:
        "Vehicles, boats, sports gear, tools, and appliances that need maintenance — anything that doesn't fit under structures or infrastructure.",
    },
  ],
  [
    "/administrer/fordelingspolicy",
    {
      title: "Split policy",
      description:
        "Rules for how shared costs are split across owners and users.",
    },
  ],
  [
    "/administrer/prioritet",
    {
      title: "Priority weeks",
      description:
        "Each main owner group picks one peak week. You can only edit your own column; everyone else's choices are visible but read-only.",
    },
  ],
  [
    "/administrer/utgiftskategorier",
    {
      title: "Expense categories",
      description:
        "Categories used to label shared expenses across the property. Add or remove the categories available when recording an expense.",
    },
  ],
  [
    "/administrer/innstillinger",
    {
      title: "Settings",
      description: "Per-property preferences and danger zone actions.",
    },
  ],
])

function RouteBanner({ pathname }: { pathname: string }) {
  const { t } = useTranslation("property")
  const td = t as (key: string) => string
  const banner = BANNERS.get(pathname)
  if (!banner) return null
  return (
    <Card asChild className={styles.banner}>
      <header>
        <Heading level={2}>{td(banner.title)}</Heading>
        <Paragraph>{td(banner.description)}</Paragraph>
      </header>
    </Card>
  )
}

const DESKTOP_GROUPS = [
  {
    label: "Property",
    items: [
      { to: "/administrer/info", label: "Info" },
      { to: "/administrer/kontakter", label: "Contacts" },
      { to: "/administrer/eierskap", label: "Ownership" },
      { to: "/administrer/bygninger", label: "Structures" },
      { to: "/administrer/infrastruktur", label: "Infrastructure" },
      { to: "/administrer/utstyr", label: "Equipment" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/administrer/brukere", label: "Users" },
      { to: "/administrer/brukergrupper", label: "User groups" },
      { to: "/administrer/invitasjoner", label: "Invites" },
    ],
  },
  {
    label: "Policies",
    items: [
      { to: "/administrer/fordelingspolicy", label: "Split policy" },
      { to: "/administrer/prioritet", label: "Priority weeks" },
      { to: "/administrer/utgiftskategorier", label: "Expense categories" },
      { to: "/administrer/innstillinger", label: "Settings" },
    ],
  },
] as const

const MOBILE_GROUPS = [
  {
    label: "Property",
    items: [
      { to: "/administrer/info", label: "Info" },
      { to: "/administrer/kontakter", label: "Contacts" },
      { to: "/administrer/eierskap", label: "Ownership" },
      { to: "/administrer/bygninger", label: "Structures" },
      { to: "/administrer/infrastruktur", label: "Infrastructure" },
      { to: "/administrer/utstyr", label: "Equipment" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/administrer/brukere", label: "Users" },
      { to: "/administrer/brukergrupper", label: "User groups" },
      { to: "/administrer/invitasjoner", label: "Invites" },
    ],
  },
  {
    label: "Policies",
    items: [
      { to: "/administrer/fordelingspolicy", label: "Split policy" },
      { to: "/administrer/prioritet", label: "Priority weeks" },
      { to: "/administrer/utgiftskategorier", label: "Expense categories" },
      { to: "/administrer/innstillinger", label: "Settings" },
    ],
  },
] as const

export function ManageProperty() {
  const { t } = useTranslation("property")
  const td = t as (key: string) => string
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { pathname } = useLocation()
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  const translateGroups = (
    groups: readonly {
      label: string
      items: readonly { to: string; label: string }[]
    }[],
  ) =>
    groups.map(g => ({
      label: td(g.label),
      items: g.items.map(i => ({ to: i.to, label: td(i.label) })),
    }))

  const help: PageHelpContent = {
    intro: t(
      "Manage Property is the admin hub for the cabin picked at the top. Here you set up and edit everything about this one place — its details, the people who can use it, and the rules the rest of the app relies on.",
    ),
    steps: [
      {
        title: t("The property itself"),
        body: t(
          "Info, Contacts, and Ownership cover the basic facts and who owns what. Structures, Infrastructure, and Equipment list the buildings, systems, and gear at the cabin.",
        ),
      },
      {
        title: t("People & access"),
        body: t(
          "Users are everyone with access, User groups bundle people together to share access and costs, and Invites let you add new people by email.",
        ),
      },
      {
        title: t("Rules & money"),
        body: t(
          "Split policy sets how shared costs are divided, Priority weeks let each main owner group claim one of the peak summer weeks (28–30), Expense categories label spending, and Settings holds per-cabin preferences.",
        ),
      },
    ],
    connections: t(
      "What you set up here powers the rest of the app: Structures and Equipment feed Maintenance and the bed and parking capacity on Plan stay; Expense categories appear when logging Expenses; Split policy and Priority weeks drive Settlement and Plan stay; and Users, groups, and invites decide who can see and use the cabin at all.",
    ),
  }

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Manage Property")} help={help} />
        <Paragraph>
          {t(
            "Add or select a property to edit its details, structures, owners, and invites.",
          )}
        </Paragraph>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Manage Property")} help={help} />

      <div className={styles.layout}>
        <div className={styles.desktopNav}>
          <SideNav
            ariaLabel={t("Property sections")}
            groups={translateGroups(DESKTOP_GROUPS)}
          />
        </div>
        <div className={styles.mobileNav}>
          <GroupTabs groups={translateGroups(MOBILE_GROUPS)} />
        </div>
        <div className={styles.content}>
          <RouteBanner pathname={pathname} />
          {selectedProperty && (
            <Heading level={3} data-size="sm" className={styles.propertyName}>
              {selectedProperty.name}
            </Heading>
          )}
          <Suspense fallback={<Paragraph>{t("Loading…")}</Paragraph>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
