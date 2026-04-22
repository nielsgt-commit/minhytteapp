import Navigation from "@/components/shared/Navigation"
import OrgMenu from "./OrgMenu"
import PropertyMenu from "./PropertyMenu.tsx"
import UserMenu from "./UserMenu"
import styles from "./Header.module.css"

export default function Header() {
  return (
    <header className={styles.header}>
      <OrgMenu />
      <PropertyMenu />
      <h1 className={styles.title}>Header</h1>
      <Navigation />
      <div className={styles.end}>
        <UserMenu />
      </div>
    </header>
  )
}