import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import styles from "./_onboarding.module.css"

export const Route = createFileRoute("/_onboarding")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" })
    }
  },
  component: OnboardingShell,
})

function OnboardingShell() {
  return (
    <div className={styles.shell}>
      <Outlet />
    </div>
  )
}