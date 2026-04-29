import CheckIn from "./CheckIn.tsx"
import PropertyMenu from "./PropertyMenu.tsx"
import UserMenu from "./UserMenu"
import UserGroupBadge from "./UserGroupBadge.tsx"
import styles from "./Header.module.css"

export default function Header() {
  return (
    <header className={styles.header}>

      <PropertyMenu />
      <UserMenu />
      <UserGroupBadge />
      <CheckIn />
      <h1 className={styles.title}> Hytta </h1>
    </header>
  )
}