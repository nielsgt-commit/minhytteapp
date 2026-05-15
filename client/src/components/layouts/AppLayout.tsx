import type { ReactNode } from "react"
import Header from "@/components/core/header/Header"
import Footer from "@/components/core/footer/Footer"
import NavTabs from "@/components/shared/NavTabs"
import BottomNavBar from "@/components/shared/BottomNavBar"
import styles from "./AppLayout.module.css"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        <NavTabs>{children}</NavTabs>
      </main>
      <Footer />
      <BottomNavBar />
    </div>
  )
}
