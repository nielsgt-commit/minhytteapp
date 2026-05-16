import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Divider, Tabs } from "@digdir/designsystemet-react"
import { Link, Outlet, useLocation } from "@tanstack/react-router"
import styles from "./ManageProperty.module.css"
import { DangerZone } from "@/features/property/dangerzone/DangerZone.tsx"
import PropertyStats from "@/features/dashboard/propertystats/PropertyStats"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

const TABS = [
  { slug: "info", label: "Info" },
  { slug: "buildings", label: "Buildings" },
  { slug: "places", label: "Places" },
  { slug: "inventory", label: "Inventory" },
  { slug: "contacts", label: "Contacts" },
  { slug: "ownership", label: "Ownership" },
  { slug: "register", label: "Register" },
  { slug: "split-policy", label: "Split policy" },
] as const

const BASE = "/manageproperty"

export function ManageProperty() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  useSuspenseQuery(trpc.property.list.queryOptions())
  const { pathname } = useLocation()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Manage Property</h1>
        <p>Add or select a property to edit its details, buildings, owners, and invites.</p>
      </section>
    )
  }

  const activeSlug =
    TABS.find(t => pathname.startsWith(`${BASE}/${t.slug}`))?.slug ?? "info"

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Manage Property</h1>
      <div className={styles.summaries}>
        <Suspense fallback={<p>Loading…</p>}>
          <PropertyStats />
        </Suspense>
      </div>

      <Tabs key={pathname} defaultValue={activeSlug}>
        <Tabs.List>
          {TABS.map(tab => (
            <Tabs.Tab key={tab.slug} value={tab.slug} style={{ position: "relative" }}>
              {tab.label}
              <Link
                to={`${BASE}/${tab.slug}`}
                aria-label={tab.label}
                style={{ position: "absolute", inset: 0 }}
              />
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value={activeSlug}>
          <Suspense fallback={<p>Loading…</p>}>
            <Outlet />
          </Suspense>
        </Tabs.Panel>
      </Tabs>

      <Divider />
      <DangerZone />
    </section>
  )
}
