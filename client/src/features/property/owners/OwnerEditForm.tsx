import { type SyntheticEvent } from "react"
import { Button, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { ownerLabel } from "./ownershipCalculations.ts"

type Owner = {
  id: number
  user_id: number | null
  user_group_id: number | null
  user_name: string | null
  user_group_name: string | null
  ownership_pct: number | string
}

type Props = {
  owner: Owner
  pending: boolean
  updatePending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onRemove: () => void
  onCancel: () => void
}

export function OwnerEditForm({
  owner,
  pending,
  updatePending,
  onSubmit,
  onRemove,
  onCancel,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      key={`edit-${String(owner.id)}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <Fieldset>
        <Fieldset.Legend>Edit owner</Fieldset.Legend>
        <p>
          <strong>{ownerLabel(owner)}</strong>
        </p>
        <Textfield
          label="Ownership %"
          name="ownership_pct"
          type="number"
          min={0}
          max={100}
          step={0.01}
          defaultValue={owner.ownership_pct}
          required
          autoFocus
          disabled={updatePending}
        />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-color="danger"
            disabled={pending}
            onClick={onRemove}
          >
            Remove
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
