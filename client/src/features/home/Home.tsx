import styles from "./Home.module.css"
import { AuthenticatedView } from "./AuthenticatedView"
import { UnauthenticatedView } from "./UnauthenticatedView"
import { loadAuth } from "@/auth/oauth"

export function Home() {
  const auth = loadAuth()

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Home</h2>
      <div className={styles.content}>
        {auth.isAuthenticated && auth.user ? (
          <AuthenticatedView userName={auth.user.name} />
        ) : (
          <UnauthenticatedView />
        )}
      </div>
    </section>
  )
}
