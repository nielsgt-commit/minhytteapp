import type { ChangeEvent } from "react"

export type User = {
  id: number
  name: string
}

type Props = {
  users: User[]
  value: number | null
  onChange: (userId: number) => void
  onAddClick: () => void
}

const ADD_SENTINEL = "__add__"

export default function UserSwitcher({
  users,
  value,
  onChange,
  onAddClick,
}: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value
    if (raw === ADD_SENTINEL) {
      onAddClick()
      return
    }
    onChange(Number(raw))
  }

  return (
    <select
      aria-label="Switch user"
      value={value ?? ""}
      onChange={handleChange}
    >
      {users.length === 0 && (
        <option value="" disabled>
          No users
        </option>
      )}
      {users.map(u => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
      <option value={ADD_SENTINEL}>+ Add user</option>
    </select>
  )
}