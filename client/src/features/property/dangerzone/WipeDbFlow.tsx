import { type SyntheticEvent, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Checkbox,
  Fieldset,
  Heading,
  Textfield,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"

const CONFIRM_PHRASE = "wipe"

export function WipeDbFlow() {
  const { t } = useTranslation("property")
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
        <Heading level={4}>{t("Wipe database")}</Heading>
        <p>
          {t(
            "Truncate every data table and (optionally) reseed with the default Owner / Member / Hytta state. For dev use only.",
          )}
        </p>
        <Button
          type="button"
          onClick={() => {
            setIsArmed(true)
          }}
        >
          {t("Wipe database…")}
        </Button>
      </div>
    )
  }

  return (
    <div>
      <Heading level={4}>{t("Wipe database")}</Heading>

      <p role="alert">
        <Trans
          t={t}
          i18nKey="<1>Warning:</1> This deletes every row in every table — properties, structures, bookings, expenses, invites, users, the lot. After the wipe the page will reload."
          components={{ 1: <strong /> }}
        />
      </p>

      <form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>{t("Confirm wipe")}</Fieldset.Legend>

          <div>
            <Textfield
              label={
                <Trans
                  t={t}
                  i18nKey="Type <1>{{phrase}}</1> to confirm"
                  values={{ phrase: CONFIRM_PHRASE }}
                  components={{ 1: <strong /> }}
                />
              }
              type="text"
              value={typed}
              onChange={e => {
                setTyped(e.target.value)
              }}
              autoComplete="off"
              autoFocus
              required
            />
          </div>

          <div>
            <Checkbox
              label={t("Reseed with Owner / Member / Hytta after wipe")}
              checked={reseed}
              onChange={e => {
                setReseed(e.target.checked)
              }}
            />
          </div>

          <div>
            <Checkbox
              label={t("I understand all data will be permanently destroyed.")}
              checked={acknowledged}
              onChange={e => {
                setAcknowledged(e.target.checked)
              }}
            />
          </div>

          <div>
            <Button type="submit" disabled={!canWipe}>
              {wipe.isPending ? t("Wiping…") : t("Wipe everything")}
            </Button>
            <Button type="button" onClick={reset} disabled={wipe.isPending}>
              {t("Cancel")}
            </Button>
          </div>

          {wipe.error && (
            <p role="alert">
              {t("Error: {{message}}", { message: wipe.error.message })}
            </p>
          )}
        </Fieldset>
      </form>
    </div>
  )
}
