import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Fieldset,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import {
  AddressLookup,
  type GeonorgeAddress,
} from "@/features/property/register/AddressLookup"
import { PropertyEvents } from "./PropertyEvents.tsx"
import styles from "./PropertyInfo.module.css"

type MatrikkelDraft = {
  address: string
  adressekode: number | null
  kommunenummer: string | null
  kommunenavn: string | null
  postnummer: string | null
  poststed: string | null
  gardsnummer: number | null
  bruksnummer: number | null
  festenummer: number | null
  undernummer: number | null
}

function draftFromAddress(a: GeonorgeAddress): MatrikkelDraft {
  return {
    address: a.adressetekst,
    adressekode: a.adressekode,
    kommunenummer: a.kommunenummer,
    kommunenavn: a.kommunenavn,
    postnummer: a.postnummer,
    poststed: a.poststed,
    gardsnummer: a.gardsnummer,
    bruksnummer: a.bruksnummer,
    festenummer: a.festenummer,
    undernummer: a.undernummer,
  }
}

export function PropertyInfo() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )

  const updateProperty = useMutationWithInvalidation(
    trpc.property.update.mutationOptions(),
    [trpc.property.mine.queryKey()],
  )

  const [isEditing, setIsEditing] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [draft, setDraft] = useState<MatrikkelDraft | null>(null)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  if (!selectedProperty) {
    return (
      <Card>
        <Card.Block>
          <Paragraph>
            {t("No property selected. Pick one from the header.")}
          </Paragraph>
        </Card.Block>
      </Card>
    )
  }

  const handleSavePropertyInfo = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    const address = (draft?.address ?? selectedProperty.address).trim()
    if (!address) return
    const familySinceRaw = fdString(fd, "in_family_since").trim()
    const familySinceNum = familySinceRaw === "" ? null : Number(familySinceRaw)
    const parkingRaw = fdString(fd, "parking_spots").trim()
    const parkingNum = parkingRaw === "" ? 0 : Number(parkingRaw)
    try {
      await updateProperty.mutateAsync({
        id: selectedProperty.id,
        name,
        address,
        in_family_since:
          familySinceNum != null && Number.isFinite(familySinceNum)
            ? familySinceNum
            : null,
        parking_spots: Number.isFinite(parkingNum) ? parkingNum : 0,
        adressekode: draft?.adressekode ?? selectedProperty.adressekode,
        kommunenummer: draft?.kommunenummer ?? selectedProperty.kommunenummer,
        gardsnummer: draft?.gardsnummer ?? selectedProperty.gardsnummer,
        bruksnummer: draft?.bruksnummer ?? selectedProperty.bruksnummer,
        festenummer: draft?.festenummer ?? selectedProperty.festenummer,
        undernummer: draft?.undernummer ?? selectedProperty.undernummer,
      })
      setIsEditing(false)
      setDraft(null)
    } catch {
      /* surfaced via ErrorAlert below */
    }
  }

  const hasMatrikkel =
    selectedProperty.adressekode != null ||
    selectedProperty.kommunenummer != null ||
    selectedProperty.gardsnummer != null ||
    selectedProperty.bruksnummer != null

  if (isEditing) {
    const previewAddress = draft?.address ?? selectedProperty.address
    return (
      <Card>
        <Card.Block>
          <ErrorAlert error={updateProperty.error} />
          <form action={handleSavePropertyInfo}>
            <Fieldset>
              <Fieldset.Legend>{t("Edit property")}</Fieldset.Legend>
              <div>
                <Textfield
                  label={t("Name")}
                  type="text"
                  name="name"
                  defaultValue={selectedProperty.name}
                  required
                />
              </div>
              <div>
                <Paragraph data-size="sm">
                  {t("Current address: {{address}}", {
                    address: previewAddress,
                  })}
                </Paragraph>
                <AddressLookup
                  label={t("Search a new address")}
                  onSelect={a => {
                    setDraft(draftFromAddress(a))
                  }}
                />
                {draft && (
                  <Paragraph data-size="sm">
                    {t("Will save: {{address}} ({{postnummer}} {{poststed}})", {
                      address: draft.address,
                      postnummer: draft.postnummer ?? "",
                      poststed: draft.poststed ?? "",
                    })}
                  </Paragraph>
                )}
              </div>
              <div>
                <Textfield
                  label={t("This property has been in the family since:")}
                  type="number"
                  name="in_family_since"
                  min={1500}
                  max={2100}
                  defaultValue={selectedProperty.in_family_since ?? ""}
                />
              </div>
              <div>
                <Textfield
                  label={t("Parking spots")}
                  type="number"
                  name="parking_spots"
                  min={0}
                  max={99}
                  defaultValue={selectedProperty.parking_spots}
                />
              </div>
              <div>
                <SubmitButton>{t("Save")}</SubmitButton>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false)
                    setDraft(null)
                  }}
                  disabled={updateProperty.isPending}
                >
                  {t("Cancel")}
                </Button>
              </div>
            </Fieldset>
          </form>
        </Card.Block>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Block>
        <Paragraph>
          {t("Property adress: ")}
          {selectedProperty.address}{" "}
          {hasMatrikkel && (
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              onClick={() => {
                setShowRegister(v => !v)
              }}
            >
              {showRegister ? t("Hide register") : t("Show register")}
            </Button>
          )}
        </Paragraph>
        {showRegister && hasMatrikkel && (
          <Card data-color="neutral">
            <Card.Block className={styles.register}>
              {(
                [
                  [t("Adressekode"), selectedProperty.adressekode],
                  [t("Kommunenummer"), selectedProperty.kommunenummer],
                  [t("Gnr"), selectedProperty.gardsnummer],
                  [t("Bnr"), selectedProperty.bruksnummer],
                  [t("Fnr"), selectedProperty.festenummer],
                  [t("Snr"), selectedProperty.undernummer],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className={styles.registerRow}>
                  <span className={styles.registerLabel}>{label}:</span>
                  <span>{value ?? "—"}</span>
                </div>
              ))}
            </Card.Block>
          </Card>
        )}
        <Paragraph>
          {t("This property has been in the family since:")}{" "}
          {selectedProperty.in_family_since ?? <em>{t("not set")}</em>}
        </Paragraph>
        <Paragraph>
          {t("Parking spots: {{count}}", {
            count: selectedProperty.parking_spots,
          })}
        </Paragraph>

        <Button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
        >
          {t("Edit property details")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setShowHistory(v => !v)
          }}
        >
          {showHistory ? t("Hide history") : t("Show history")}
        </Button>
        {showHistory && (
          <QueryBoundary>
            <PropertyEvents />
          </QueryBoundary>
        )}
      </Card.Block>
    </Card>
  )
}
