import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Fieldset,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import {
  AddressLookup,
  type GeonorgeAddress,
} from "@/features/property/register/AddressLookup"

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

export default function PropertyInfo() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const updateProperty = useMutation(
    trpc.property.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
      },
    }),
  )

  const [isEditing, setIsEditing] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [draft, setDraft] = useState<MatrikkelDraft | null>(null)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  if (!selectedProperty) {
    return (
      <Card>
        <Card.Block>
          <h1>Property Info</h1>
          <p>No property selected. Pick one from the header.</p>
        </Card.Block>
      </Card>
    )
  }

  const handleSavePropertyInfo = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    const address = (draft?.address ?? selectedProperty.address).trim()
    if (!address) return
    const linkRaw = fdString(fd, "link").trim()
    const parkingRaw = fdString(fd, "parking_spots").trim()
    const parkingNum = parkingRaw === "" ? 0 : Number(parkingRaw)
    updateProperty.mutate(
      {
        id: selectedProperty.id,
        name,
        address,
        link: linkRaw === "" ? null : linkRaw,
        parking_spots: Number.isFinite(parkingNum) ? parkingNum : 0,
        adressekode: draft?.adressekode ?? selectedProperty.adressekode,
        kommunenummer: draft?.kommunenummer ?? selectedProperty.kommunenummer,
        gardsnummer: draft?.gardsnummer ?? selectedProperty.gardsnummer,
        bruksnummer: draft?.bruksnummer ?? selectedProperty.bruksnummer,
        festenummer: draft?.festenummer ?? selectedProperty.festenummer,
        undernummer: draft?.undernummer ?? selectedProperty.undernummer,
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          setDraft(null)
        },
      },
    )
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
          <h1>Property Info</h1>
          {updateProperty.error && (
            <p role="alert">Error: {updateProperty.error.message}</p>
          )}
          <form onSubmit={handleSavePropertyInfo}>
            <Fieldset>
              <Fieldset.Legend>Edit property</Fieldset.Legend>
              <div>
                <Textfield
                  label="Name"
                  type="text"
                  name="name"
                  defaultValue={selectedProperty.name}
                  required
                />
              </div>
              <div>
                <Paragraph data-size="sm">
                  Current address: {previewAddress}
                </Paragraph>
                <AddressLookup
                  label="Search a new address"
                  onSelect={a => { setDraft(draftFromAddress(a)) }}
                />
                {draft && (
                  <Paragraph data-size="sm">
                    Will save: {draft.address} ({draft.postnummer}{" "}
                    {draft.poststed})
                  </Paragraph>
                )}
              </div>
              <div>
                <Textfield
                  label="Link"
                  type="text"
                  name="link"
                  defaultValue={selectedProperty.link ?? ""}
                />
              </div>
              <div>
                <Textfield
                  label="Parking spots"
                  type="number"
                  name="parking_spots"
                  min={0}
                  max={99}
                  defaultValue={selectedProperty.parking_spots}
                />
              </div>
              <div>
                <Button type="submit" disabled={updateProperty.isPending}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false)
                    setDraft(null)
                  }}
                  disabled={updateProperty.isPending}
                >
                  Cancel
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
        <h1>Property Info</h1>
        <p>{selectedProperty.name}</p>
        <p>
          {selectedProperty.address}{" "}
          {hasMatrikkel && (
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              onClick={() => { setShowRegister(v => !v) }}
            >
              {showRegister ? "Hide register" : "Show register"}
            </Button>
          )}
        </p>
        {showRegister && hasMatrikkel && (
          <dl>
            <dt>Adressekode</dt>
            <dd>{selectedProperty.adressekode ?? "—"}</dd>
            <dt>Kommunenummer</dt>
            <dd>{selectedProperty.kommunenummer ?? "—"}</dd>
            <dt>Gnr</dt>
            <dd>{selectedProperty.gardsnummer ?? "—"}</dd>
            <dt>Bnr</dt>
            <dd>{selectedProperty.bruksnummer ?? "—"}</dd>
            <dt>Fnr</dt>
            <dd>{selectedProperty.festenummer ?? "—"}</dd>
            <dt>Snr</dt>
            <dd>{selectedProperty.undernummer ?? "—"}</dd>
          </dl>
        )}
        <p>
          Link:{" "}
          {selectedProperty.link != null && selectedProperty.link !== "" ? (
            <a href={selectedProperty.link} target="_blank" rel="noreferrer">
              {selectedProperty.link}
            </a>
          ) : (
            <em>none</em>
          )}
        </p>
        <p> Property description </p>
        <p>Parking spots: {selectedProperty.parking_spots}</p>

        <Button type="button" onClick={() => { setIsEditing(true) }}>
          Edit property details
        </Button>
      </Card.Block>
    </Card>
  )
}
