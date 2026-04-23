import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import UserSwitcher from "./UserSwitcher"
import styles from "./Header.module.css"

export default function UserMenu() {
  const trpc = useTRPC()
  const { data: users, isLoading } = useQuery(trpc.user.list.queryOptions())
  const [selectedId, setSelectedId] = useState<number>(1)

  const list = users ?? []
  const current = list.find(u => u.id === selectedId)

  let label: string
  if (isLoading) {
    label = "Loading…"
  } else if (current) {
    label = current.name
  } else {
    label = "No user"
  }

  return (
    <div className={styles.menu}>
      <span>{label}</span>
      <UserSwitcher
        users={list}
        value={selectedId}
        onChange={id => { setSelectedId(id) }}
      />
    </div>
  )
}