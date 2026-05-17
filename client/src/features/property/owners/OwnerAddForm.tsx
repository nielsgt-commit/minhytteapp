import { type SyntheticEvent } from "react"
import {
  Button,
  Chip,
  Fieldset,
  Label,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"

type AddKind = "user" | "group"

type UserOption = { id: number; name: string }
type GroupOption = { id: number; name: string; members: unknown[] }

type Props = {
  addKind: AddKind
  pending: boolean
  addDisabled: boolean
  availableUsers: UserOption[]
  availableGroups: GroupOption[]
  totalGroups: number
  onKindChange: (kind: AddKind) => void
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export function OwnerAddForm({
  addKind,
  pending,
  addDisabled,
  availableUsers,
  availableGroups,
  totalGroups,
  onKindChange,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      key={`add-${addKind}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <Fieldset>
        <Fieldset.Legend>Add owner</Fieldset.Legend>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Chip.Radio
            name="kind"
            value="user"
            checked={addKind === "user"}
            onChange={() => { onKindChange("user") }}
          >
            User
          </Chip.Radio>
          <Chip.Radio
            name="kind"
            value="group"
            checked={addKind === "group"}
            onChange={() => { onKindChange("group") }}
          >
            Group
          </Chip.Radio>
        </div>

        {addKind === "user" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <Label htmlFor="add-owner-user">User</Label>
            <Select
              id="add-owner-user"
              name="user_id"
              required
              defaultValue=""
              disabled={pending || availableUsers.length === 0}
            >
              <Select.Option value="" disabled>
                Select user
              </Select.Option>
              {availableUsers.map(u => (
                <Select.Option key={u.id} value={String(u.id)}>
                  {u.name}
                </Select.Option>
              ))}
            </Select>
            {availableUsers.length === 0 && (
              <p>
                <em>All users are already owners.</em>
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <Label htmlFor="add-owner-group">Group</Label>
            <Select
              id="add-owner-group"
              name="user_group_id"
              required
              defaultValue=""
              disabled={pending || availableGroups.length === 0}
            >
              <Select.Option value="" disabled>
                Select group
              </Select.Option>
              {availableGroups.map(g => (
                <Select.Option key={g.id} value={String(g.id)}>
                  {g.name} ({g.members.length} member
                  {g.members.length === 1 ? "" : "s"})
                </Select.Option>
              ))}
            </Select>
            {availableGroups.length === 0 && (
              <p>
                <em>
                  No available groups.{" "}
                  {totalGroups === 0
                    ? "Create one from Manage user groups."
                    : "All groups are already owners."}
                </em>
              </p>
            )}
          </div>
        )}

        <Textfield
          label="Ownership %"
          name="ownership_pct"
          type="number"
          min={0}
          max={100}
          step={0.01}
          defaultValue={0}
          required
          disabled={pending}
        />

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="submit" disabled={addDisabled}>
            Add owner
          </Button>
          <Button
            type="button"
            variant="tertiary"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </Fieldset>
    </form>
  )
}
