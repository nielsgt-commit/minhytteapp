import { Link, linkOptions, useLocation } from "@tanstack/react-router"
import {
  CalendarIcon,
  CalendarFillIcon,
  ClipboardCheckmarkIcon,
  FileTextIcon,
  FileTextFillIcon,
  HouseIcon,
  HouseFillIcon,
  NotePencilIcon,
  PlusIcon,
  WalletIcon,
  WrenchIcon,
  WrenchFillIcon,
} from "@navikt/aksel-icons"
import { useEffect, useRef, useState } from "react"
import type { ComponentType, SVGProps } from "react"
import { useTranslation } from "react-i18next"
import styles from "./BottomNavBar.module.css"

// Aksel icons are SVG components; we just need a callable component type
// that accepts the standard SVG props plus an optional fontSize.
type IconComp = ComponentType<SVGProps<SVGSVGElement> & { fontSize?: string }>
type NavLabel = "Dashboard" | "Plan" | "Maintenance" | "Settlement"

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
    to: "/oversikt",
    label: "Dashboard",
    Icon: asIcon(HouseIcon),
    IconActive: asIcon(HouseFillIcon),
  },
  {
    to: "/planleggopphold",
    label: "Plan",
    Icon: asIcon(CalendarIcon),
    IconActive: asIcon(CalendarFillIcon),
  },
  {
    to: "/vedlikehold",
    label: "Maintenance",
    Icon: asIcon(WrenchIcon),
    IconActive: asIcon(WrenchFillIcon),
  },
  {
    to: "/oppgjor",
    label: "Settlement",
    Icon: asIcon(FileTextIcon),
    IconActive: asIcon(FileTextFillIcon),
  },
]

const links = linkOptions(navItems.map(({ to }) => ({ to })))

const PlusGlyph = asIcon(PlusIcon)

// The drop-up "+" quick actions, each navigating to a route's add form. The
// expense action carries the wallet icon previously shown in the bottom nav
// (its slot is now occupied by the FAB).
const addActions = linkOptions([
  { to: "/utlegg", label: "New expense" },
  { to: "/handleliste", label: "New innkjøp" },
  { to: "/oppgaver", label: "New todo" },
])

type AddLabel = "New expense" | "New innkjøp" | "New todo"

const addIcons: Record<AddLabel, IconComp> = {
  "New expense": asIcon(WalletIcon),
  "New innkjøp": asIcon(NotePencilIcon),
  "New todo": asIcon(ClipboardCheckmarkIcon),
}

export function BottomNavBar() {
  const { t } = useTranslation("shared")
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const fabRef = useRef<HTMLDivElement>(null)

  const labels: Record<NavLabel, string> = {
    Dashboard: t("Dashboard"),
    Plan: t("Plan stay"),
    Maintenance: t("Maintenance"),
    Settlement: t("Settlement"),
  }

  const addLabels: Record<AddLabel, string> = {
    "New expense": t("New expense"),
    "New innkjøp": t("New innkjøp"),
    "New todo": t("New todo"),
  }

  useEffect(() => {
    if (!menuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen])

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
      <div ref={fabRef} className={styles.fabWrap}>
        {menuOpen && (
          <div className={styles.menu} role="menu" aria-label={t("Add new")}>
            {addActions.map(action => {
              const Glyph = addIcons[action.label]
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenuOpen(false)
                  }}
                >
                  <Glyph aria-hidden fontSize="1.25rem" />
                  <span>{addLabels[action.label]}</span>
                </Link>
              )
            })}
          </div>
        )}
        <button
          type="button"
          className={styles.fab}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t("Add new")}
          onClick={() => {
            setMenuOpen(open => !open)
          }}
        >
          <PlusGlyph aria-hidden fontSize="1.75rem" />
        </button>
      </div>
    </nav>
  )
}
