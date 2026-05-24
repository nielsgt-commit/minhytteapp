import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import styles from "./Home.module.css"

export function HomeLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation("home")
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t("Home")}</h1>
      <div className={styles.content}>{children}</div>
    </section>
  )
}
