
import { Chip } from "@digdir/designsystemet-react"

export const PROPERTY_PANELS = [
  "info",
  "buildings",
  "places",
  "inventory",
  "contacts",
  "ownership",
  "register",
  "split_policy",
] as const

export type PropertyPanel = (typeof PROPERTY_PANELS)[number]

const LABELS: Record<PropertyPanel, string> = {
  info: "Info",
  buildings: "Buildings",
  places: "Places",
  inventory: "Inventory",
  contacts: "Contacts",
  ownership: "Ownership",
  register: "Register",
  split_policy: "Split policy",
}

type Props = {
  value: PropertyPanel
  onChange: (value: PropertyPanel) => void
}

export function PropertyManagerFilter({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Property section"
      style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
    >
      {PROPERTY_PANELS.map(panel => (
        <Chip.Radio
          key={panel}
          name="property-panel"
          value={panel}
          checked={value === panel}
          onChange={() => { onChange(panel) }}
        >
          {LABELS[panel]}
        </Chip.Radio>
      ))}
    </div>
  )
}
