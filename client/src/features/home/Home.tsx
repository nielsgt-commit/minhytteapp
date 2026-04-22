import styles from "./Home.module.css"

export function Home() {
  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Home</h2>
      <div className={styles.content}>
          <h3> Visible when user is not logged in</h3>
           <p> Log in or create account </p>
      </div>
    </section>
  )
}