import type { ChangeEvent } from "react"

export type Property = {
  id: number
  name: string
}

type Props = {
  properties: Property[]
  value: number | null
  onChange: (propertyId: number) => void
  onAddClick: () => void
}

const ADD_SENTINEL = "__add__"

export default function PropertySwitcher({
  properties,
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
      aria-label="Switch property"
      value={value ?? ""}
      onChange={handleChange}
    >
      {properties.length === 0 && (
        <option value="" disabled>
          No properties
        </option>
      )}
      {properties.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      <option value={ADD_SENTINEL}>+ Add property</option>
    </select>
  )
}