import { Heading } from "@digdir/designsystemet-react"
import PropertyMenu from "./PropertyMenu.tsx"
import UserMenu from "./UserMenu"
import HeaderUserGroupPanel from "./HeaderUserGroupPanel.tsx"
import styles from "./Header.module.css"
import CheckIn from "@/components/core/header/CheckIn.tsx"

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <PropertyMenu />
        <UserMenu />
        <HeaderUserGroupPanel />
        <Heading level={1} className={styles.title}>
          {" "}
        </Heading>
        <div className={styles.end}>
          <CheckIn />
        </div>
      </div>
    </header>
  )
}