import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./Home.module.css"

export function HomeLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation("home")
  return (
    <section className={styles.page}>
      <Heading level={1} className={styles.title}>
        {t("Home")}
      </Heading>
      <div className={styles.content}>{children}</div>
    </section>
  )
}
