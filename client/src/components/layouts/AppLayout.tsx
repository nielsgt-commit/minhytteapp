import type { ReactNode } from "react"
import { useLocation } from "@tanstack/react-router"
import Header from "@/components/core/header/Header"
import NavTabs from "@/components/shared/NavTabs"
import BottomNavBar from "@/components/shared/BottomNavBar"
import { useAuthSession } from "@/auth/auth-client"
import styles from "./AppLayout.module.css"

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuthSession()
  const isUnauthenticatedHome = pathname === "/" && !isAuthenticated

  return (
    <div className={styles.shell}>
      {isUnauthenticatedHome ? null : <Header />}
      <main className={styles.main}>
        {isUnauthenticatedHome ? children : <NavTabs>{children}</NavTabs>}
      </main>
      {isUnauthenticatedHome ? null : <BottomNavBar />}
    </div>
  )
}
