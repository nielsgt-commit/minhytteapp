import type { ChangeEvent } from "react"

export type Organization = {
  id: string
  name: string
}

export const organizations: Organization[] = [
  { id: "org-1", name: "Organization 1" },
  { id: "org-2", name: "Organization 2" },
  { id: "org-3", name: "Organization 3" },
]

type Props = {
  value: string
  onChange: (organizationId: string) => void
}

export default function OrgSwitcher({ value, onChange }: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value)
  }

  return (
    <select
      aria-label="Switch organization"
      value={value}
      onChange={handleChange}
    >
      {organizations.map(org => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  )
}
