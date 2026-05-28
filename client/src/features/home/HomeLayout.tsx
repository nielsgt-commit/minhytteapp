import type { ReactNode } from "react"
import styles from "./Home.module.css"

export function HomeLayout({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>
}
