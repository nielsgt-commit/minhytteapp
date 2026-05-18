import type { ReactNode } from "react"
import styles from "./Home.module.css"

export function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Home</h1>
      <div className={styles.content}>{children}</div>
    </section>
  )
}
