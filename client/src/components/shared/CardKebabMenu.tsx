import { useState } from "react"
import { Dropdown } from "@digdir/designsystemet-react"
import { MenuElipsisVerticalIcon } from "@navikt/aksel-icons"

export type CardKebabItem = {
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

type Props = {
  ariaLabel: string
  items: CardKebabItem[]
}

export function CardKebabMenu({ ariaLabel, items }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        variant="tertiary"
        data-size="sm"
        icon
        aria-label={ariaLabel}
        onClick={() => {
          setOpen(o => !o)
        }}
      >
        <MenuElipsisVerticalIcon aria-hidden />
      </Dropdown.Trigger>
      <Dropdown
        placement="bottom-end"
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      >
        <Dropdown.List>
          {items.map(item => (
            <Dropdown.Item key={item.label}>
              <Dropdown.Button
                data-color={item.danger ? "danger" : undefined}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </Dropdown.Button>
            </Dropdown.Item>
          ))}
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  )
}
