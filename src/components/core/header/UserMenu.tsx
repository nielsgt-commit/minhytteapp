import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { logout, selectUser } from "@/features/auth/authSlice"
import UserSwitcher, { type UserAction } from "./UserSwitcher"
import styles from "./Header.module.css"

export default function UserMenu() {
  const user = useAppSelector(selectUser)
  const dispatch = useAppDispatch()

  const handleAction = (action: UserAction) => {
    if (action === "log-out") {
      dispatch(logout())
    }
  }

  return (
    <div className={styles.menu}>
      <span>{user?.name ?? "Guest"}</span>
      <UserSwitcher onAction={handleAction} />
    </div>
  )
}