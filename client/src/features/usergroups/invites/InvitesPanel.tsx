import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Card, Select, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus.ts"
import { fdString } from "@/utils/formData.ts"

const GROUP_NONE = ""

type InvitesPanelProps = {
  canEdit: boolean
}

export function InvitesPanel({ canEdit }: InvitesPanelProps) {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0

  const listQuery = useSuspenseQuery(
    trpc.allowedEmail.list.queryOptions({ property_id: propertyId }),
  )
  const groupsQuery = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.allowedEmail.list.queryKey(),
    })
  }

  const add = useMutation(
    trpc.allowedEmail.add.mutationOptions({ onSuccess: invalidate }),
  )
  const remove = useMutation(
    trpc.allowedEmail.remove.mutationOptions({ onSuccess: invalidate }),
  )

  const [open, setOpen] = useState(false)

  const { pending, error: lastError } = useMutationsStatus(add, remove)

  const entries = listQuery.data
  const mainGroups = groupsQuery.data.filter(g => g.is_main)
  const groupName = (id: number | null) =>
    id == null ? null : (groupsQuery.data.find(g => g.id === id)?.name ?? null)

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const email = fdString(fd, "email").trim()
    if (!email) return
    const groupRaw = fdString(fd, "user_group_id")
    const pctRaw = fdString(fd, "ownership_pct").trim()
    const user_group_id =
      groupRaw && groupRaw !== GROUP_NONE ? Number(groupRaw) : null
    const ownership_pct = pctRaw === "" ? null : Number(pctRaw)
    if (ownership_pct != null && !Number.isFinite(ownership_pct)) return
    add.mutate(
      {
        email,
        property_id: propertyId,
        user_group_id,
        ownership_pct,
      },
      {
        onSuccess: () => {
          form.reset()
          setOpen(false)
        },
      },
    )
  }

  const handleRemove = (id: number, email: string) => {
    if (!window.confirm(t("Remove {{email}} from the allowlist?", { email }))) {
      return
    }
    remove.mutate({ id })
  }

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <h3>{t("Invites")}</h3>
          <p>
            {t(
              "People with these emails can request a sign-in link, even if they don't have an invite yet.",
            )}
          </p>

          {lastError && (
            <p role="alert">
              {t("Error: {{message}}", { message: lastError.message })}
            </p>
          )}

          {entries.length === 0 ? (
            <p>{t("No invites yet.")}</p>
          ) : (
            <ul>
              {entries.map(entry => {
                const group = groupName(entry.user_group_id)
                const status = entry.used_at ? t("Accepted") : t("Pending")
                return (
                  <li key={entry.id}>
                    <strong>{entry.email}</strong>
                    {group ? <span> – {group}</span> : null}
                    {entry.ownership_pct != null ? (
                      <span> – {entry.ownership_pct}%</span>
                    ) : null}
                    <span> – <em>{status}</em></span>
                    {entry.added_by_name ? (
                      <span> – {t("added by {{name}}", { name: entry.added_by_name })}</span>
                    ) : null}
                    {!entry.used_at && canEdit && (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          aria-label={t("Remove invite {{email}}", { email: entry.email })}
                          onClick={() => { handleRemove(entry.id, entry.email) }}
                        >
                          {t("Remove")}
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {canEdit && (
            <div>
              <Button
                type="button"
                disabled={pending}
                onClick={() => { setOpen(v => !v) }}
              >
                {open ? t("Cancel") : t("Add email")}
              </Button>
            </div>
          )}

          {canEdit && open && (
            <form onSubmit={handleAdd}>
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
                  <label>
                    {t("Group")}
                    <Select name="user_group_id" defaultValue={GROUP_NONE}>
                      <Select.Option value={GROUP_NONE}>
                        {t("(none)")}
                      </Select.Option>
                      {mainGroups.map(g => (
                        <Select.Option key={g.id} value={g.id}>
                          {g.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </label>
                </div>
                <div>
                  <Textfield
                    label={t("Ownership %")}
                    type="number"
                    name="ownership_pct"
                    min={0}
                    max={100}
                    step={0.01}
                  />
                </div>
                <div>
                  <Button type="submit" disabled={add.isPending}>
                    {t("Add")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setOpen(false) }}
                    disabled={add.isPending}
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
