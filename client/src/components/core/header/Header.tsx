import { Paragraph } from "@digdir/designsystemet-react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { PropertyMenu } from "./PropertyMenu"
import { UserMenu } from "./UserMenu"
import styles from "./Header.module.css"
import { CheckIn } from "./CheckIn"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useAuthSession } from "@/auth/auth-client"
import { useTRPC } from "@/trpc/trpc"

export function Header() {
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
          {/* DEV-ONLY: jump into the onboarding wizard regardless of state.
              Delete this block (and the `?preview=1` branch in
              routes/_onboarding/onboarding.tsx) when the wizard ships. */}
          {import.meta.env.DEV && auth.isAuthenticated && (
            <Link
              to="/onboarding"
              search={{ preview: true }}
              className={styles.devOnboardingLink}
            >
              🛠 Onboarding
            </Link>
          )}
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
