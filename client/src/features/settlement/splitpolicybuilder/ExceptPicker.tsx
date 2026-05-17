import { Field, Label, Select } from "@digdir/designsystemet-react"
import type { GroupWithMembers, PropertyUser } from "./types"

type Props = {
  propertyUsers: PropertyUser[]
  groups: GroupWithMembers[]
  selectedEncoded: Set<string>
  onAdd: (encoded: string) => void
}

export function ExceptPicker({
  propertyUsers,
  groups,
  selectedEncoded,
  onAdd,
}: Props) {
  return (
    <Field>
      <Label data-size="sm">Add exclude</Label>
      <Select
        value=""
        onChange={e => {
          onAdd(e.target.value)
          e.target.value = ""
        }}
      >
        <Select.Option value="">— pick someone to exclude —</Select.Option>
        <Select.Option value="kids" disabled={selectedEncoded.has("kids")}>
          Kids (all child users)
        </Select.Option>
        <Select.Optgroup label="Users">
          {propertyUsers.map(u => {
            const enc = `user:${String(u.user_id)}`
            return (
              <Select.Option
                key={enc}
                value={enc}
                disabled={selectedEncoded.has(enc)}
              >
                {u.user_name}
              </Select.Option>
            )
          })}
        </Select.Optgroup>
        <Select.Optgroup label="Groups">
          {groups.map(g => {
            const enc = `group:${String(g.id)}`
            return (
              <Select.Option
                key={enc}
                value={enc}
                disabled={selectedEncoded.has(enc)}
              >
                {g.name}
              </Select.Option>
            )
          })}
        </Select.Optgroup>
      </Select>
    </Field>
  )
}
