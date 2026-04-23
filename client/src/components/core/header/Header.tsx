import Navigation from "@/components/shared/Navigation"
import PropertyMenu from "./PropertyMenu.tsx"
import UserMenu from "./UserMenu"
import styles from "./Header.module.css"

export default function Header() {
  return (
    <header className={styles.header}>

      <PropertyMenu />
      <UserMenu />
      <h6>user group</h6>
      <h1 className={styles.title}>Header</h1>
      <Navigation />
    </header>
  )
}