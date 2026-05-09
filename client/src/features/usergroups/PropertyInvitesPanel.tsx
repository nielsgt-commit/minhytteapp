import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Card } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  if (typeof v !== "string" || v === "") return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`
}

export function PropertyInvitesPanel() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const propertyId = useAppSelector(selectSelectedPropertyId)

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

  if (propertyId == null) {
    return (
      <Card asChild>
        <section>
          <Card.Block>
            <h3>Invites</h3>
            <p>No property selected. Pick one from the header.</p>
          </Card.Block>
        </section>
      </Card>
    )
  }

  const invites = invitesQuery.data
  const lastError = create.error ?? revoke.error
  const pending = create.isPending || revoke.isPending

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
    if (!window.confirm(`Revoke invite for ${email}?`)) return
    revoke.mutate({ id, property_id: propertyId })
  }

  return (
    <Card asChild>
      <section>
        <Card.Block>
      <h3>Invites</h3>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {invites.length === 0 ? (
        <p>No invites yet.</p>
      ) : (
        <ul>
          {invites.map(inv => {
            const expired = new Date(inv.expires_at).getTime() < Date.now()
            const status = inv.used_at
              ? `Accepted${inv.used_by_name ? ` by ${inv.used_by_name}` : ""}`
              : expired
                ? "Expired"
                : "Pending"
            return (
              <li key={inv.id}>
                <strong>{inv.email}</strong> – {inv.ownership_pct}% –{" "}
                <em>{status}</em>
                {!inv.used_at && !expired && (
                  <div>
                    <button
                      type="button"
                      onClick={() => { handleCopy(inv.id, inv.token) }}
                    >
                      {copied === inv.id ? "Copied!" : "Copy invite link"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => { handleRevoke(inv.id, inv.email) }}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => { setOpen(v => !v) }}
        >
          {open ? "Cancel" : "Create invite"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleCreate}>
          <fieldset>
            <legend>New invite</legend>
            <div>
              <label>
                Email
                <input type="email" name="email" required autoFocus />
              </label>
            </div>
            <div>
              <label>
                Ownership %
                <input
                  type="number"
                  name="ownership_pct"
                  min={0}
                  max={100}
                  step={0.01}
                  defaultValue={0}
                  required
                />
              </label>
            </div>
            <div>
              <button type="submit" disabled={create.isPending}>
                Create
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false) }}
                disabled={create.isPending}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
        </Card.Block>
      </section>
    </Card>
  )
}
