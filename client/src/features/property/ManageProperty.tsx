import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Outlet } from "@tanstack/react-router"
import styles from "./ManageProperty.module.css"
import { SideNav } from "@/components/shared/SideNav"
import { GroupTabs } from "@/components/shared/GroupTabs"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

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
    { to: "/manageproperty/register", label: "Register" },
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
    { to: "/manageproperty/register", label: "Register" },
    { to: "/manageproperty/split-policy", label: "Split policy" },
    { to: "/manageproperty/settings", label: "Settings" },
  ]},
] as const

export function ManageProperty() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  useSuspenseQuery(trpc.property.list.queryOptions())

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Manage Property</h1>
        <p>Add or select a property to edit its details, structures, owners, and invites.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Manage Property</h1>

      <div className={styles.layout}>
        <div className={styles.desktopNav}>
          <SideNav ariaLabel="Property sections" groups={DESKTOP_GROUPS} />
        </div>
        <div className={styles.mobileNav}>
          <GroupTabs groups={MOBILE_GROUPS} />
        </div>
        <div className={styles.content}>
          <Suspense fallback={<p>Loading…</p>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
