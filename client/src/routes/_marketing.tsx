import { Outlet, createFileRoute } from "@tanstack/react-router"
import styles from "./_marketing.module.css"

export const Route = createFileRoute("/_marketing")({
  component: MarketingShell,
})

function MarketingShell() {
  return (
    <div className={styles.shell}>
      <Outlet />
    </div>
  )
}