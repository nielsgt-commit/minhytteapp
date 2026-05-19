import { type SyntheticEvent } from "react"
import { useTranslation } from "react-i18next"

type RoomDefaults = {
  name: string
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

type Props = {
  legend: string
  submitLabel: string
  pending: boolean
  defaults?: RoomDefaults
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export function RoomFormSection({
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
          <label>
            {t("Beds (single)")}
            <input
              type="number"
              name="beds_sm"
              min={0}
              defaultValue={defaults?.beds_sm ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            {t("Beds (large)")}
            <input
              type="number"
              name="beds_lg"
              min={0}
              defaultValue={defaults?.beds_lg ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            {t("Beds (double)")}
            <input
              type="number"
              name="beds_double"
              min={0}
              defaultValue={defaults?.beds_double ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            {t("Beds (kid)")}
            <input
              type="number"
              name="beds_kid"
              min={0}
              defaultValue={defaults?.beds_kid ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            {t("Mattresses")}
            <input
              type="number"
              name="mattresses"
              min={0}
              defaultValue={defaults?.mattresses ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            {t("Travel cot")}
            <input
              type="number"
              name="travel_cot"
              min={0}
              defaultValue={defaults?.travel_cot ?? 0}
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
