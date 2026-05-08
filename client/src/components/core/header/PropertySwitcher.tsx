import { type SyntheticEvent, useEffect, useState } from "react"
import { Button, Divider, Dropdown, Label, Paragraph, Textfield } from '@digdir/designsystemet-react';
import { ChevronDownIcon } from '@navikt/aksel-icons';
import styles from "./PropertySwitcher.module.css"

export type Property = {
  id: number
  name: string
}

type Props = {
  properties: Property[]
  value: number | null
  onChange: (propertyId: number) => void
  isAddOpen: boolean
  onAddOpenChange: (open: boolean) => void
  onAdd: (name: string) => void
  onManageProperty: () => void
  onUserGroups: () => void
  isAddPending?: boolean
  addError?: string | null
}

export default function PropertySwitcher({
  properties,
  value,
  onChange,
  isAddOpen,
  onAddOpenChange,
  onAdd,
  onManageProperty,
  onUserGroups,
  isAddPending,
  addError,
}: Props) {
  const current = properties.find(p => p.id === value)
  const triggerLabel = current?.name ?? "Select property"

  const [name, setName] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isAddOpen) setName("")
  }, [isAddOpen])

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <Label id="property-switcher-label" className={styles.label}>Property</Label>
      <Dropdown.TriggerContext>
        <Dropdown.Trigger
          variant="tertiary"
          data-color="neutral"
          aria-labelledby="property-switcher-label"
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
          {isAddOpen ? (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem" }}
            >
              <Textfield
                label="New property name"
                name="name"
                value={name}
                onChange={e => { setName(e.target.value) }}
                autoFocus
                required
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button type="submit" loading={isAddPending}>Save</Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isAddPending}
                  onClick={() => { onAddOpenChange(false) }}
                >
                  Cancel
                </Button>
              </div>
              {addError && (
                <Paragraph data-color="danger" role="alert">Error: {addError}</Paragraph>
              )}
            </form>
          ) : (
            <Dropdown.List>
              {properties.length === 0 && (
                <Dropdown.Item>
                  <span>No properties</span>
                </Dropdown.Item>
              )}
              {properties.map(p => (
                <Dropdown.Item key={p.id}>
                  <Dropdown.Button onClick={() => { onChange(p.id) }}>
                    {p.name}
                  </Dropdown.Button>
                </Dropdown.Item>
              ))}
              <Divider />
              <Dropdown.Item>
                <Dropdown.Button onClick={() => { onAddOpenChange(true) }}>
                  + Add property
                </Dropdown.Button>
              </Dropdown.Item>
              <Divider />
              <Dropdown.Item>
                <Dropdown.Button onClick={onManageProperty}>
                  Manage Property
                </Dropdown.Button>
              </Dropdown.Item>
              <Dropdown.Item>
                <Dropdown.Button onClick={onUserGroups}>
                  User groups
                </Dropdown.Button>
              </Dropdown.Item>
            </Dropdown.List>
          )}
        </Dropdown>
      </Dropdown.TriggerContext>
    </div>
  )
}