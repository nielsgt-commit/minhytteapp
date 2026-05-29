import type { ReactNode } from "react"
import { Link, linkOptions, useLocation } from "@tanstack/react-router"
import { Tabs } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./NavTabs.module.css"

const navLinks = linkOptions([
  { to: "/oversikt", label: "Dashboard" },
  { to: "/kalender", label: "Calendar" },
  { to: "/vedlikehold", label: "Maintenance" },
  { to: "/utlegg", label: "Expenses" },
  { to: "/oppgjor", label: "Settlement" },
])

export default function NavTabs({ children }: { children: ReactNode }) {
  const { t } = useTranslation("shared")
  const { pathname } = useLocation()

  const labels: Record<(typeof navLinks)[number]["label"], string> = {
    Dashboard: t("Dashboard"),
    Calendar: t("Calendar"),
    Maintenance: t("Maintenance"),
    Expenses: t("Expenses"),
    Settlement: t("Settlement"),
  }

  const activeValue = navLinks.find(l => pathname.startsWith(l.to))?.to ?? ""

  return (
    <>
      <Tabs key={pathname} defaultValue={activeValue}>
        <Tabs.List
          className={`${styles.list}${activeValue ? "" : ` ${styles.noActive}`}`}
        >
          {navLinks.map(link => (
            <Tabs.Tab
              key={link.to}
              value={link.to}
              style={{ position: "relative" }}
            >
              {labels[link.label]}
              <Link
                {...link}
                aria-label={labels[link.label]}
                style={{ position: "absolute", inset: 0 }}
              />
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {activeValue && (
          <Tabs.Panel value={activeValue} className={styles.panel}>
            {children}
          </Tabs.Panel>
        )}
      </Tabs>
      {!activeValue && <div className={styles.panel}>{children}</div>}
    </>
  )
}
