import {
  Outlet,
  createFileRoute,
  redirect,
  retainSearchParams,
} from "@tanstack/react-router"
import { selectionSearchSchema } from "@/selection/searchSchema"
import { getSession } from "@/auth/auth-client"
import { trpc } from "@/trpc/client"
import styles from "./_authed.module.css"

export const Route = createFileRoute("/_authed")({
  validateSearch: selectionSearchSchema,
  search: {
    middlewares: [retainSearchParams(["property", "user"])],
  },
  beforeLoad: async ({ context, search, location }) => {
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
    // Default MISSING selection params from the same sources the header
    // menus select from (PropertyMenu → property.mine, UserMenu → user.me).
    // Never override a param that is already present — overriding would race
    // with e.g. create-property navigating to the new id.
    if (search.property == null || search.user == null) {
      let property = search.property
      let user = search.user
      if (property == null) {
        const properties = await context.queryClient
          .ensureQueryData(trpc.property.mine.queryOptions())
          .catch(() => null)
        property = properties?.[0]?.id
      }
      user ??= me?.id
      if (property !== search.property || user !== search.user) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw redirect({
          to: location.pathname,
          search: { ...search, property, user },
          replace: true,
        })
      }
    }
    return {
      selectedUserId: search.user ?? null,
      selectedPropertyId: search.property ?? null,
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
