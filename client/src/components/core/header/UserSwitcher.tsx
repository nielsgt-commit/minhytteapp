import type { ChangeEvent } from "react"

export type User = {
  id: number
  name: string
}

type Props = {
  users: User[]
  value: number | null
  onChange: (userId: number) => void
}

export default function UserSwitcher({ users, value, onChange }: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(Number(event.target.value))
  }

  if (users.length === 0) {
    return (
      <select aria-label="Switch user" disabled>
        <option value="">No users</option>
      </select>
    )
  }

  return (
    <select
      aria-label="Switch user"
      value={value ?? ""}
      onChange={handleChange}
    >
      {users.map(u => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  )
}