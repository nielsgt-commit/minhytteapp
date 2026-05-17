import { type SyntheticEvent } from "react"

type NameOnlyDefaults = { name: string }

type Props = {
  legend: string
  submitLabel: string
  pending: boolean
  defaults?: NameOnlyDefaults
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export function StructureFormSection({
  legend,
  submitLabel,
  pending,
  defaults,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>{legend}</legend>
        <div>
          <label>
            Name
            <input
              type="text"
              name="name"
              defaultValue={defaults?.name ?? ""}
              required
            />
          </label>
        </div>
        <div>
          <button type="submit" disabled={pending}>
            {submitLabel}
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}
