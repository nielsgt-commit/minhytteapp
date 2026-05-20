import { Heading } from "@digdir/designsystemet-react"
import PropertyMenu from "./PropertyMenu.tsx"
import UserMenu from "./UserMenu"
import styles from "./Header.module.css"
import CheckIn from "@/components/core/header/CheckIn.tsx"

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <PropertyMenu />
        <Heading level={1} className={styles.title}>
          {" "}
        </Heading>
        <div className={styles.end}>
          <div className={styles.hideOnMobileBlock}>
            <CheckIn />
          </div>
          <div className={styles.hideOnMobile}>
            <UserMenu showCheckIn={false} />
          </div>
          <div className={styles.showOnMobile}>
            <UserMenu showCheckIn={true} />
          </div>
        </div>
      </div>
    </header>
  )
}
