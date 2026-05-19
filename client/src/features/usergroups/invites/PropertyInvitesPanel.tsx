import { useSelectedPropertyId } from "@/app/useSelectedIds.ts"
import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Card, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus.ts"
import { fdNumber, fdString } from "@/utils/formData.ts"

function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`
}

export function PropertyInvitesPanel() {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const propertyId = useSelectedPropertyId()

  const invitesQuery = useSuspenseQuery(
    trpc.invite.list.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled: propertyId != null },
    ),
  )

  const invalidate = () => {
    if (propertyId == null) return
    void qc.invalidateQueries({
      queryKey: trpc.invite.list.queryKey({ property_id: propertyId }),
    })
  }

  const create = useMutation(
    trpc.invite.create.mutationOptions({ onSuccess: invalidate }),
  )
  const revoke = useMutation(
    trpc.invite.revoke.mutationOptions({ onSuccess: invalidate }),
  )

  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  const { pending, error: lastError } = useMutationsStatus(create, revoke)

  if (propertyId == null) {
    return (
      <Card asChild>
        <section>
          <Card.Block>
            <h3>{t("Invites")}</h3>
            <p>{t("No property selected. Pick one from the header.")}</p>
          </Card.Block>
        </section>
      </Card>
    )
  }

  const invites = invitesQuery.data

  const handleCreate = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const email = fdString(fd, "email").trim()
    const pct = fdNumber(fd, "ownership_pct")
    if (!email || !Number.isFinite(pct)) return
    create.mutate(
      { property_id: propertyId, email, ownership_pct: pct },
      {
        onSuccess: () => {
          form.reset()
          setOpen(false)
        },
      },
    )
  }

  const handleCopy = (id: number, token: string) => {
    void navigator.clipboard.writeText(inviteUrl(token)).then(() => {
      setCopied(id)
      window.setTimeout(() => { setCopied(c => (c === id ? null : c)) }, 1500)
    })
  }

  const handleRevoke = (id: number, email: string) => {
    if (!window.confirm(t("Revoke invite for {{email}}?", { email }))) return
    revoke.mutate({ id, property_id: propertyId })
  }

  return (
    <Card asChild>
      <section>
        <Card.Block>
      <h3>{t("Invites")}</h3>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      {invites.length === 0 ? (
        <p>{t("No invites yet.")}</p>
      ) : (
        <ul>
          {invites.map(inv => {
            const expired = new Date(inv.expires_at).getTime() < Date.now()
            const status = inv.used_at
              ? inv.used_by_name
                ? t("Accepted by {{name}}", { name: inv.used_by_name })
                : t("Accepted")
              : expired
                ? t("Expired")
                : t("Pending")
            return (
              <li key={inv.id}>
                <strong>{inv.email}</strong> – {inv.ownership_pct}% –{" "}
                <em>{status}</em>
                {!inv.used_at && !expired && (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => { handleCopy(inv.id, inv.token) }}
                    >
                      {copied === inv.id ? t("Copied!") : t("Copy invite link")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => { handleRevoke(inv.id, inv.email) }}
                    >
                      {t("Revoke")}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div>
        <Button
          type="button"
          disabled={pending}
          onClick={() => { setOpen(v => !v) }}
        >
          {open ? t("Cancel") : t("Create invite")}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleCreate}>
          <fieldset>
            <legend>{t("New invite")}</legend>
            <div>
              <Textfield
                label={t("Email")}
                type="email"
                name="email"
                required
                autoFocus
              />
            </div>
            <div>
              <Textfield
                label={t("Ownership %")}
                type="number"
                name="ownership_pct"
                min={0}
                max={100}
                step={0.01}
                defaultValue={0}
                required
              />
            </div>
            <div>
              <Button type="submit" disabled={create.isPending}>
                {t("Create")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setOpen(false) }}
                disabled={create.isPending}
              >
                {t("Cancel")}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
        </Card.Block>
      </section>
    </Card>
  )
}
