import type { ChangeEvent } from "react"

export type UserAction = "switch-user" | "log-out"

type Props = {
  onAction: (action: UserAction) => void
}

export default function UserSwitcher({ onAction }: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    if (value === "switch-user" || value === "log-out") {
      onAction(value)
    }
    event.target.selectedIndex = 0
  }

  return (
    <select aria-label="User menu" defaultValue="" onChange={handleChange}>
      <option value="" disabled>
        Account
      </option>
      <option value="switch-user">Switch user</option>
      <option value="log-out">Log out</option>
    </select>
  )
}