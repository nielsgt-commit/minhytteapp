import { type SyntheticEvent, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Checkbox,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"

const CONFIRM_PHRASE = "wipe"

export function WipeDbFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const wipe = useMutation(
    trpc.dev.wipe.mutationOptions({
      onSuccess: () => {
        qc.clear()
        window.location.replace("/")
      },
    }),
  )

  const [isArmed, setIsArmed] = useState(false)
  const [typed, setTyped] = useState("")
  const [reseed, setReseed] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)

  const phraseMatches = typed === CONFIRM_PHRASE
  const canWipe = phraseMatches && acknowledged && !wipe.isPending

  const reset = () => {
    setIsArmed(false)
    setTyped("")
    setAcknowledged(false)
    setReseed(true)
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canWipe) return
    wipe.mutate({ reseed })
  }

  if (!isArmed) {
    return (
      <div>
        <h4>Wipe database</h4>
        <p>
          Truncate every data table and (optionally) reseed with the default
          Owner / Member / Hytta state. For dev use only.
        </p>
        <Button type="button" onClick={() => { setIsArmed(true) }}>
          Wipe database…
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h4>Wipe database</h4>

      <p role="alert">
        <strong>Warning:</strong> This deletes every row in every table —
        properties, structures, bookings, expenses, invites, users, the lot.
        After the wipe the page will reload.
      </p>

      <form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>Confirm wipe</Fieldset.Legend>

          <div>
            <Textfield
              label={
                <>
                  Type <strong>{CONFIRM_PHRASE}</strong> to confirm
                </>
              }
              type="text"
              value={typed}
              onChange={e => { setTyped(e.target.value) }}
              autoComplete="off"
              autoFocus
              required
            />
          </div>

          <div>
            <Checkbox
              label="Reseed with Owner / Member / Hytta after wipe"
              checked={reseed}
              onChange={e => { setReseed(e.target.checked) }}
            />
          </div>

          <div>
            <Checkbox
              label="I understand all data will be permanently destroyed."
              checked={acknowledged}
              onChange={e => { setAcknowledged(e.target.checked) }}
            />
          </div>

          <div>
            <Button type="submit" disabled={!canWipe}>
              {wipe.isPending ? "Wiping…" : "Wipe everything"}
            </Button>
            <Button
              type="button"
              onClick={reset}
              disabled={wipe.isPending}
            >
              Cancel
            </Button>
          </div>

          {wipe.error && <p role="alert">Error: {wipe.error.message}</p>}
        </Fieldset>
      </form>
    </div>
  )
}
