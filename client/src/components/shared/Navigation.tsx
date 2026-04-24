import { Link, linkOptions } from "@tanstack/react-router"
import styles from "./Navigation.module.css"

const navLinks = linkOptions([
  { to: "/", label: "Home", activeOptions: { exact: true } },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/calendar", label: "Calendar" },
  { to: "/expenses", label: "Expenses" },
  { to: "/maintenance", label: "Maintenance" },
  { to: "/settlement", label: "Settlement" },
  { to: "/manageproperty", label: "Manage Property" },
  { to: "/usergroups", label: "User groups" },
])

export default function Navigation() {
  return (
    <nav className={styles.nav}>
      {navLinks.map((link) => (
        <Link
          key={link.to}
          {...link}
          activeProps={{ className: styles.active }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
