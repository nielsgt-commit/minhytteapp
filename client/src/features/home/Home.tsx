import styles from "./Home.module.css"
import { loadAuth, logout, startLogin } from "@/auth/oauth"

export function Home() {
  const auth = loadAuth()

  const handleLogout = () => {
    logout()
    window.location.replace("/")
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Home</h2>
      <div className={styles.content}>
        {auth.isAuthenticated && auth.user ? (
          <>
            <p>Signed in as <strong>{auth.user.name}</strong></p>
            <button onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <h3> Visible when user is not logged in</h3>
            <p> Log in or create account </p>
            <button onClick={() => { startLogin() }}>Log in</button>
          </>
        )}
      </div>
    </section>
  )
}