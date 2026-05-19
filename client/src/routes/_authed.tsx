import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { selectSelectedUserId } from "@/features/user/userSlice"
import styles from "./_authed.module.css"

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" })
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