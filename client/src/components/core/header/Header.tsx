import { Heading } from "@digdir/designsystemet-react"
import PropertyMenu from "./PropertyMenu.tsx"
import UserMenu from "./UserMenu"
import MobileUserMenu from "./MobileUserMenu"
import HeaderUserGroupPanel from "./HeaderUserGroupPanel.tsx"
import styles from "./Header.module.css"
import CheckIn from "@/components/core/header/CheckIn.tsx"

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <PropertyMenu />
        <div className={styles.hideOnMobile}>
          <UserMenu />
          <HeaderUserGroupPanel />
        </div>
        <Heading level={1} className={styles.title}>
          {" "}
        </Heading>
        <div className={styles.showOnMobile}>
          <MobileUserMenu />
        </div>
        <div className={`${styles.end} ${styles.hideOnMobileBlock}`}>
          <CheckIn />
        </div>
      </div>
    </header>
  )
}