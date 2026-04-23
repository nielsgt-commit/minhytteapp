import type { ChangeEvent } from "react"

export type Property = {
  id: number
  name: string
}

type Props = {
  properties: Property[]
  value: number | null
  onChange: (propertyId: number) => void
}

export default function PropertySwitcher({ properties, value, onChange }: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(Number(event.target.value))
  }

  if (properties.length === 0) {
    return (
      <select aria-label="Switch property" disabled>
        <option value="">No properties</option>
      </select>
    )
  }

  return (
    <select
      aria-label="Switch property"
      value={value ?? ""}
      onChange={handleChange}
    >
      {properties.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}