import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { getSession } from "@/auth/auth-client"
import { trpc } from "@/trpc/client"
import styles from "./_authed.module.css"

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ["auth", "session"],
      queryFn: () => getSession().then(r => r.data),
    })
    if (!session) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" })
    }
    const me = await context.queryClient
      .ensureQueryData(trpc.user.me.queryOptions())
      .catch(() => null)
    if (
      me &&
      me.onboarding_step !== "done" &&
      me.onboarding_dismissed_at == null &&
      // A user who already belongs to a property (e.g. invited into it) has
      // nothing to set up. Self-onboarding always advances the step off null
      // before a membership is created, so a null step + an existing main
      // membership is an invitee whose onboarding flag was never cleared —
      // let them in rather than trapping them in the setup wizard.
      !(me.onboarding_step == null && me.my_main_memberships.length > 0)
    ) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/onboarding" })
    }
    const state = store.getState()
    return {
      selectedUserId: selectSelectedUserId(state),
      selectedPropertyId: selectSelectedPropertyId(state),
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
