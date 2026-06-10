import type { ReactNode } from "react"
import { useLocation } from "@tanstack/react-router"
import { Header } from "@/components/core/header/Header"
import { NavTabs } from "@/components/shared/NavTabs"
import { BottomNavBar } from "@/components/shared/BottomNavBar"
import { useAuthSession } from "@/auth/auth-client"
import styles from "./AppLayout.module.css"

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuthSession()
  const isUnauthenticatedHome = pathname === "/" && !isAuthenticated
  const isOnboarding = pathname.startsWith("/onboarding")
  const bare = isUnauthenticatedHome || isOnboarding

  return (
    <div className={styles.shell}>
      {bare ? null : <Header />}
      <main className={`${styles.main}${bare ? ` ${styles.bareMain}` : ""}`}>
        {bare ? children : <NavTabs>{children}</NavTabs>}
      </main>
      {bare ? null : <BottomNavBar />}
    </div>
  )
}
