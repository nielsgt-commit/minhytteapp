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
import styles from "./BottomNavBar.module.css"

type IconComp = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>

const navItems: { to: string; label: string; Icon: IconComp; IconActive: IconComp }[] = [
  { to: "/dashboard", label: "Dashboard", Icon: HouseIcon, IconActive: HouseFillIcon },
  { to: "/calendar", label: "Calendar", Icon: CalendarIcon, IconActive: CalendarFillIcon },
  { to: "/expenses", label: "Expenses", Icon: WalletIcon, IconActive: WalletFillIcon },
  { to: "/maintenance", label: "Maintenance", Icon: WrenchIcon, IconActive: WrenchFillIcon },
  { to: "/settlement", label: "Settlement", Icon: FileTextIcon, IconActive: FileTextFillIcon },
]

const links = linkOptions(navItems.map(({ to }) => ({ to })))

export default function BottomNavBar() {
  const { pathname } = useLocation()

  return (
    <nav className={styles.bar} aria-label="Primary">
      {navItems.map((item, i) => {
        const isActive = pathname.startsWith(item.to)
        const Glyph = isActive ? item.IconActive : item.Icon
        return (
          <Link
            key={item.to}
            {...links[i]}
            className={`${styles.item} ${isActive ? styles.active : ""}`}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <Glyph aria-hidden fontSize="1.5rem" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
