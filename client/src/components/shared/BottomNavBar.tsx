import { Link, linkOptions, useLocation } from "@tanstack/react-router"
import {
  CalendarIcon,
  CalendarFillIcon,
  FileTextIcon,
  FileTextFillIcon,
  HouseIcon,
  HouseFillIcon,
  WalletIcon,
  WalletFillIcon,
  WrenchIcon,
  WrenchFillIcon,
} from "@navikt/aksel-icons"
import type { ComponentType, SVGProps } from "react"
import { useTranslation } from "react-i18next"
import styles from "./BottomNavBar.module.css"

// Aksel icons are SVG components; we just need a callable component type
// that accepts the standard SVG props plus an optional fontSize.
type IconComp = ComponentType<SVGProps<SVGSVGElement> & { fontSize?: string }>
type NavLabel =
  | "Dashboard"
  | "Calendar"
  | "Expenses"
  | "Maintenance"
  | "Settlement"

// typescript-eslint's project service occasionally reports the Aksel icon
// imports as "error typed" even though `tsc` is happy with them, so we cast
// each one once at the navItems table.
const asIcon = (c: unknown): IconComp => c as IconComp

const navItems: {
  to: string
  label: NavLabel
  Icon: IconComp
  IconActive: IconComp
}[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    Icon: asIcon(HouseIcon),
    IconActive: asIcon(HouseFillIcon),
  },
  {
    to: "/calendar",
    label: "Calendar",
    Icon: asIcon(CalendarIcon),
    IconActive: asIcon(CalendarFillIcon),
  },
  {
    to: "/expenses",
    label: "Expenses",
    Icon: asIcon(WalletIcon),
    IconActive: asIcon(WalletFillIcon),
  },
  {
    to: "/maintenance",
    label: "Maintenance",
    Icon: asIcon(WrenchIcon),
    IconActive: asIcon(WrenchFillIcon),
  },
  {
    to: "/settlement",
    label: "Settlement",
    Icon: asIcon(FileTextIcon),
    IconActive: asIcon(FileTextFillIcon),
  },
]

const links = linkOptions(navItems.map(({ to }) => ({ to })))

export default function BottomNavBar() {
  const { t } = useTranslation("shared")
  const { pathname } = useLocation()

  const labels: Record<NavLabel, string> = {
    Dashboard: t("Dashboard"),
    Calendar: t("Calendar"),
    Expenses: t("Expenses"),
    Maintenance: t("Maintenance"),
    Settlement: t("Settlement"),
  }

  return (
    <nav className={styles.bar} aria-label={t("Primary")}>
      {navItems.map((item, i) => {
        const isActive = pathname.startsWith(item.to)
        const Glyph = isActive ? item.IconActive : item.Icon
        return (
          <Link
            key={item.to}
            {...links[i]}
            className={`${styles.item} ${isActive ? styles.active : ""}`}
            aria-label={labels[item.label]}
            aria-current={isActive ? "page" : undefined}
          >
            <Glyph aria-hidden fontSize="1.5rem" />
            <span>{labels[item.label]}</span>
          </Link>
        )
      })}
    </nav>
  )
}
