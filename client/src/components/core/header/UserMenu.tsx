import { getRouteApi } from "@tanstack/react-router"
import UserSwitcher, { type UserAction } from "./UserSwitcher"
import styles from "./Header.module.css"

const rootApi = getRouteApi("__root__")

export default function UserMenu() {
  const { auth } = rootApi.useRouteContext()

  const handleAction = (_action: UserAction) => {
    // no-op until trpc.auth.{login,logout} is wired up
  }

  return (
    <div className={styles.menu}>
      <span>{auth.user?.name ?? "Guest"}</span>
      <UserSwitcher onAction={handleAction} />
    </div>
  )
}