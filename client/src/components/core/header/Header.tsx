import { Paragraph } from "@digdir/designsystemet-react"
import { useQuery } from "@tanstack/react-query"
import PropertyMenu from "./PropertyMenu.tsx"
import UserMenu from "./UserMenu"
import styles from "./Header.module.css"
import CheckIn from "@/components/core/header/CheckIn.tsx"
import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useAuthSession } from "@/auth/auth-client"
import { useTRPC } from "@/trpc/trpc"

export default function Header() {
  const trpc = useTRPC()
  const auth = useAuthSession()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: properties } = useQuery(
    trpc.property.mine.queryOptions(undefined, {
      enabled: auth.isAuthenticated,
    }),
  )
  const current = properties?.find(p => p.id === selectedPropertyId)

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <PropertyMenu />
        <Paragraph className={styles.adress}>
          {current ? `${current.address} ` : " "}
        </Paragraph>
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
