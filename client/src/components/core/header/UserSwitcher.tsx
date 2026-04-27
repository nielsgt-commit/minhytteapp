import type { ChangeEvent } from "react"

export type User = {
  id: number
  name: string
}

type Props = {
  users: User[]
  value: number | null
  onChange: (userId: number) => void
  onLogout: () => void
}

const LOGOUT_SENTINEL = "__logout__"

export default function UserSwitcher({
  users,
  value,
  onChange,
  onLogout,
}: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value
    if (raw === LOGOUT_SENTINEL) {
      onLogout()
      return
    }
    onChange(Number(raw))
  }

  if (users.length === 0) return null

  return (
    <select
      aria-label="User menu"
      value={value ?? ""}
      onChange={handleChange}
    >
      {users.map(u => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
      <option value={LOGOUT_SENTINEL}>Log out</option>
    </select>
  )
}