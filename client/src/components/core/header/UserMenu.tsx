import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import {
  selectSelectedUserId,
  setSelectedUserId,
} from "@/features/user/userSlice"
import { loadAuth, logout } from "@/auth/oauth"
import UserSwitcher from "./UserSwitcher"
import styles from "./Header.module.css"

export default function UserMenu() {
  const trpc = useTRPC()

  const auth = loadAuth()
  const { data: me, isLoading } = useQuery(
    trpc.user.me.queryOptions(undefined, { enabled: auth.isAuthenticated }),
  )
  const selectedId = useAppSelector(selectSelectedUserId)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const list = me ? [me] : []

  useEffect(() => {
    if (list.length === 0) return
    const stillExists = list.some(u => u.id === selectedId)
    if (!stillExists) {
      dispatch(setSelectedUserId(list[0].id))
    }
  }, [list, selectedId, dispatch])

  const handleLogout = () => {
    logout()
    window.location.assign("/")
  }

  if (!auth.user) return null

  const current = list.find(u => u.id === selectedId)

  let label: string
  if (isLoading) {
    label = "Loading…"
  } else if (current) {
    label = ""
  } else {
    label = "No user"
  }

  return (
    <div className={styles.menu} style={{ alignSelf: "flex-end" }}>
      <span> {label}</span>
      <UserSwitcher
        users={list}
        value={selectedId}
        onChange={id => { dispatch(setSelectedUserId(id)) }}
        onLogout={handleLogout}
        onSettings={() => { void navigate({ to: "/usersettings" }) }}
      />
    </div>
  )
}
