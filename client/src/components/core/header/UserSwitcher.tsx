import { useState } from "react"
import { Divider, Dropdown, Label } from '@digdir/designsystemet-react';
import { ChevronDownIcon } from '@navikt/aksel-icons';


export type User = {
  id: number
  name: string
}

type Props = {
  users: User[]
  value: number | null
  onChange: (userId: number) => void
  onLogout: () => void
  onSettings: () => void
}

export default function UserSwitcher({
  users,
  value,
  onChange,
  onLogout,
  onSettings,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (users.length === 0) return null

  const current = users.find(u => u.id === value)
  const triggerLabel = current?.name ?? "Select user"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <Label id="user-switcher-label">Logged in as</Label>
      <Dropdown.TriggerContext>
        <Dropdown.Trigger
          variant="tertiary"
          data-color="neutral"
          aria-labelledby="user-switcher-label"
        >
          {triggerLabel}
          <ChevronDownIcon
            aria-hidden
            style={{
              transition: "transform 150ms ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </Dropdown.Trigger>
        <Dropdown
          placement="bottom-start"
          open={isOpen}
          onOpen={() => { setIsOpen(true) }}
          onClose={() => { setIsOpen(false) }}
        >
          <Dropdown.List>
            {users.map(u => (
              <Dropdown.Item key={u.id}>
                <Dropdown.Button onClick={() => { onChange(u.id) }}>
                  {u.name}
                </Dropdown.Button>
              </Dropdown.Item>
            ))}
            <Divider />
            <Dropdown.Item>
              <Dropdown.Button onClick={onSettings}>Settings</Dropdown.Button>
            </Dropdown.Item>
            <Dropdown.Item>
              <Dropdown.Button data-color="danger" onClick={onLogout}>
                Log out
              </Dropdown.Button>
            </Dropdown.Item>
          </Dropdown.List>
        </Dropdown>
      </Dropdown.TriggerContext>
    </div>
  )
}