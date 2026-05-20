import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { getSession } from "@/auth/auth-client"
import styles from "./_onboarding.module.css"

export const Route = createFileRoute("/_onboarding")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ["auth", "session"],
      queryFn: () => getSession().then(r => r.data),
    })
    if (!session) {
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
