import { type SyntheticEvent } from "react"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation("property")
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>{legend}</legend>
        <div>
          <label>
            {t("Name")}
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
            {t("Cancel")}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
