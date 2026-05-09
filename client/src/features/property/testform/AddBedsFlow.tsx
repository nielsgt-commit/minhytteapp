import { type SyntheticEvent, useState } from "react"
import {
  Button,
  Chip,
  Fieldset,
  Label,
  Textfield,
} from "@digdir/designsystemet-react"

type BedKey =
  | "beds_sm"
  | "beds_lg"
  | "beds_double"
  | "beds_kid"
  | "mattresses"
  | "travel_cot"

const BED_KEYS = [
  "beds_sm",
  "beds_lg",
  "beds_double",
  "beds_kid",
  "mattresses",
  "travel_cot",
] as const satisfies readonly BedKey[]

const BED_LABELS: Record<BedKey, string> = {
  beds_sm: "Beds (single)",
  beds_lg: "Beds (large)",
  beds_double: "Beds (double)",
  beds_kid: "Beds (kid)",
  mattresses: "Mattresses",
  travel_cot: "Travel cot",
}

export type RoomData = {
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
  defaults?: RoomData
  onSubmit: (data: RoomData) => void
  onCancel: () => void
}

export function AddBedsFlow({
  legend,
  submitLabel,
  pending,
  defaults,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(defaults?.name ?? "")
  const [beds, setBeds] = useState<Partial<Record<BedKey, number | "">>>(() => {
    if (!defaults) return {}
    const out: Partial<Record<BedKey, number | "">> = {}
    for (const k of BED_KEYS) {
      if (defaults[k] > 0) out[k] = defaults[k]
    }
    return out
  })
  const [lastAddedKey, setLastAddedKey] = useState<BedKey | null>(null)

  const addedKeys = BED_KEYS.filter(k => k in beds)
  const availableKeys = BED_KEYS.filter(k => !(k in beds))

  const setBedCount = (key: BedKey, value: number | "") => {
    setBeds(b => ({ ...b, [key]: value }))
  }

  const countOf = (key: BedKey) => {
    const v = beds[key]
    return typeof v === "number" && v > 0 ? v : 0
  }

  const addBedType = (key: BedKey) => {
    setBeds(b => ({ ...b, [key]: 1 }))
    setLastAddedKey(key)
  }

  const removeBedType = (key: BedKey) => {
    setBeds(b => {
      const next = { ...b }
      delete next[key]
      return next
    })
    setLastAddedKey(prev => (prev === key ? null : prev))
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({
      name: trimmed,
      beds_sm: countOf("beds_sm"),
      beds_lg: countOf("beds_lg"),
      beds_double: countOf("beds_double"),
      beds_kid: countOf("beds_kid"),
      mattresses: countOf("mattresses"),
      travel_cot: countOf("travel_cot"),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Fieldset>
        <Fieldset.Legend>{legend}</Fieldset.Legend>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <Textfield
            label="Room name"
            value={name}
            onChange={e => { setName(e.target.value) }}
            required
            autoFocus
          />

          {addedKeys.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {addedKeys.map(key => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "0.5rem",
                  }}
                >
                  <Textfield
                    label={BED_LABELS[key]}
                    type="number"
                    min={1}
                    value={beds[key] ?? ""}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === "") {
                        setBedCount(key, "")
                        return
                      }
                      const n = Number(raw)
                      if (Number.isFinite(n)) setBedCount(key, Math.max(1, Math.floor(n)))
                    }}
                    autoFocus={key === lastAddedKey}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => { removeBedType(key) }}
                    disabled={pending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {availableKeys.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <Label>Add bed type</Label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                {availableKeys.map(key => (
                  <Chip.Button
                    key={key}
                    type="button"
                    onClick={() => { addBedType(key) }}
                  >
                    + {BED_LABELS[key]}
                  </Chip.Button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="tertiary"
              onClick={onCancel}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Fieldset>
    </form>
  )
}
