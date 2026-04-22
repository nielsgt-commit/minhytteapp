import type { ChangeEvent } from "react"

export type Property = {
  id: string
  name: string
}

export const properties: Property[] = [
  { id: "property-1", name: "Property 1" },
  { id: "property-2", name: "Property 2" },
  { id: "property-3", name: "Property 3" },
]

type Props = {
  value: string
  onChange: (organizationId: string) => void
}

export default function PropertySwitcher({ value, onChange }: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value)
  }

  return (
    <select aria-label="Switch organization" value={value} onChange={handleChange}>
      {properties.map(org => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  )
}
