import { Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdNumber, fdString } from "@/utils/formData"
import { SubmitButton } from "@/components/shared/SubmitButton"

export type PropertyBasicsValues = {
  address: string
  name: string
  parking_spots: number
}

type Props = {
  initial?: Partial<PropertyBasicsValues>
  onSubmit: (input: PropertyBasicsValues) => Promise<void>
}

export function PropertyBasicsStep({ initial, onSubmit }: Props) {
  const { t } = useTranslation("onboarding")

  return (
    <form
      action={async fd => {
        const address = fdString(fd, "address").trim()
        const name = fdString(fd, "name").trim() || address
        const parkingRaw = fdNumber(fd, "parking_spots")
        const parking_spots = Number.isFinite(parkingRaw)
          ? Math.max(0, Math.floor(parkingRaw))
          : 0
        if (!address) return
        try {
          await onSubmit({ address, name, parking_spots })
        } catch {
          /* surfaced by caller */
        }
      }}
    >
      <Fieldset>
        <Fieldset.Legend>{t("Tell us about the property")}</Fieldset.Legend>
        <p>
          {t(
            "Start with the address, give it a nickname, and tell us how many cars fit in the driveway.",
          )}
        </p>
        <div>
          <Textfield
            label={t("Address")}
            name="address"
            type="text"
            required
            defaultValue={initial?.address ?? ""}
            autoFocus
          />
        </div>
        <div>
          <Textfield
            label={t("Nickname (optional)")}
            name="name"
            type="text"
            defaultValue={initial?.name ?? ""}
          />
        </div>
        <div>
          <Textfield
            label={t("Parking spots")}
            name="parking_spots"
            type="number"
            min={0}
            max={99}
            step={1}
            inputMode="numeric"
            defaultValue={String(initial?.parking_spots ?? 0)}
          />
        </div>
        <div>
          <SubmitButton>{t("Continue")}</SubmitButton>
        </div>
      </Fieldset>
    </form>
  )
}
