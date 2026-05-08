import type { ReactNode } from "react"
import { Link, linkOptions, useLocation } from "@tanstack/react-router"
import { Tabs } from "@digdir/designsystemet-react"
import styles from "./NavTabs.module.css"

const navLinks = linkOptions([
  { to: "/dashboard", label: "Dashboard" },
  { to: "/calendar", label: "Calendar" },
  { to: "/expenses", label: "Expenses" },
  { to: "/maintenance", label: "Maintenance" },
  { to: "/settlement", label: "Settlement" },
  { to: "/manageproperty", label: "Manage Property" },
  { to: "/usergroups", label: "User groups" },
])

export default function NavTabs({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  const activeValue =
    navLinks.find(l => pathname.startsWith(l.to))?.to ?? ""

  return (
    <>
      <Tabs key={pathname} defaultValue={activeValue}>
        <Tabs.List className={styles.list}>
          {navLinks.map(link => (
            <Tabs.Tab key={link.to} value={link.to} style={{ position: "relative" }}>
              {link.label}
              <Link
                {...link}
                aria-label={link.label}
                style={{ position: "absolute", inset: 0 }}
              />
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {activeValue && <Tabs.Panel value={activeValue}>{children}</Tabs.Panel>}
      </Tabs>
      {!activeValue && <div>{children}</div>}
    </>
  )
}