import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import styles from "./_authed.module.css"

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" })
    }
  },
  component: AuthedShell,
})

function AuthedShell() {
  return (
    <div className={styles.shell}>
      <Outlet />
    </div>
  )
}