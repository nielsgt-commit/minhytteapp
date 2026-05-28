import { useState } from "react"
import {
  Card,
  Fieldset,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdNumber, fdString } from "@/utils/formData"
import {
  AddressLookup,
  type GeonorgeAddress,
} from "@/features/property/register/AddressLookup"

export type PropertyBasicsValues = {
  address: string
  name: string
  parking_spots: number
  adressekode: number | null
  kommunenummer: string | null
  gardsnummer: number | null
  bruksnummer: number | null
  festenummer: number | null
  undernummer: number | null
}

export const PROPERTY_BASICS_FORM_ID = "onboarding-property-basics"

type Initial = {
  address?: string
  name?: string
  parking_spots?: number
}

type Props = {
  initial?: Initial
  onSubmit: (input: PropertyBasicsValues) => Promise<void>
}

type AddressDraft = {
  address: string
  postnummer: string | null
  poststed: string | null
  adressekode: number | null
  kommunenummer: string | null
  gardsnummer: number | null
  bruksnummer: number | null
  festenummer: number | null
  undernummer: number | null
}

const fromGeonorge = (a: GeonorgeAddress): AddressDraft => ({
  address: a.adressetekst,
  postnummer: a.postnummer,
  poststed: a.poststed,
  adressekode: a.adressekode,
  kommunenummer: a.kommunenummer,
  gardsnummer: a.gardsnummer,
  bruksnummer: a.bruksnummer,
  festenummer: a.festenummer,
  undernummer: a.undernummer,
})

export function PropertyBasicsStep({ initial, onSubmit }: Props) {
  const { t } = useTranslation("onboarding")
  const [draft, setDraft] = useState<AddressDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effectiveAddress = draft?.address ?? initial?.address ?? ""

  return (
    <form
      id={PROPERTY_BASICS_FORM_ID}
      action={async fd => {
        const address = effectiveAddress.trim()
        if (!address) {
          setError(t("Please select an address from the suggestions."))
          return
        }
        const name = fdString(fd, "name").trim()
        if (!name) {
          setError(t("Please give the property a name."))
          return
        }
        setError(null)
        const parkingRaw = fdNumber(fd, "parking_spots")
        const parking_spots = Number.isFinite(parkingRaw)
          ? Math.max(0, Math.floor(parkingRaw))
          : 0
        try {
          await onSubmit({
            address,
            name,
            parking_spots,
            adressekode: draft?.adressekode ?? null,
            kommunenummer: draft?.kommunenummer ?? null,
            gardsnummer: draft?.gardsnummer ?? null,
            bruksnummer: draft?.bruksnummer ?? null,
            festenummer: draft?.festenummer ?? null,
            undernummer: draft?.undernummer ?? null,
          })
        } catch {
          /* surfaced by caller */
        }
      }}
    >
      <Fieldset>
        <Fieldset.Legend>{t("Tell us about the property")}</Fieldset.Legend>
        <Paragraph>
          {t(
            "Look up the official address — weather and map features rely on it.",
          )}
        </Paragraph>

        {effectiveAddress && (
          <Card>
            <Paragraph data-size="md">
            {draft
              ? t("Selected: {{address}} ({{postnummer}} {{poststed}})", {
                  address: draft.address,
                  postnummer: draft.postnummer ?? "",
                  poststed: draft.poststed ?? "",
                })
              : t("Current: {{address}}", { address: effectiveAddress })}
          </Paragraph>
          </Card>
        )}

        <AddressLookup
          label={
            effectiveAddress
              ? t("Search a different address")
              : t("Search address")
          }
          onSelect={a => {
            setDraft(fromGeonorge(a))
            setError(null)
          }}
        />

        {error && (
          <Paragraph data-size="sm" role="alert">
            {error}
          </Paragraph>
        )}

        <div>
          <Textfield
            label={t("Property name")}
            description={t(
              "What the family calls the place — used everywhere in the app.",
            )}
            name="name"
            type="text"
            required
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
      </Fieldset>
    </form>
  )
}
