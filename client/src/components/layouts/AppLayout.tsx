import type { ReactNode } from "react"
import Header from "@/components/core/header/Header"
import Footer from "@/components/core/footer/Footer"
import NavTabs from "@/components/shared/NavTabs"
import styles from "./AppLayout.module.css"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Header />
      <main>
        <NavTabs>{children}</NavTabs>
      </main>
      <Footer />
    </div>
  )
}
