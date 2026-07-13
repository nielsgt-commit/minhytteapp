import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
  Heading,
  List,
  Paragraph,
  Tag,
  Textfield,
} from "@digdir/designsystemet-react"
import { ExclamationmarkTriangleFillIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation.ts"
import { fdBoolean, fdString } from "@/utils/formData.ts"
import { isSyntheticEmail } from "@/utils/syntheticEmail.ts"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import { AddUserRow } from "./AddUserRow"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import styles from "./ListUsers.module.css"

type ListUsersProps = {
  canEdit: boolean
}

export function ListUsers({ canEdit }: ListUsersProps) {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0

  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const isAdmin = me?.is_admin ?? false

  // allowedEmail.list is head/admin-guarded on the server, so only fetch it
  // when this client can edit — otherwise regular members would get a 403.
  const invitesQuery = useQuery({
    ...trpc.allowedEmail.list.queryOptions({ property_id: propertyId }),
    enabled: canEdit,
  })
  const pendingInvites = (invitesQuery.data ?? []).filter(
    e => e.used_at == null,
  )

  const userAndGroupKeys = [trpc.user.pathKey(), trpc.userGroup.pathKey()]
  const updateUser = useMutationWithInvalidation(
    trpc.user.update.mutationOptions(),
    userAndGroupKeys,
  )
  const deleteUser = useMutationWithInvalidation(
    trpc.user.delete.mutationOptions(),
    userAndGroupKeys,
  )
  const removeInvite = useMutationWithInvalidation(
    trpc.allowedEmail.remove.mutationOptions(),
    [trpc.allowedEmail.list.queryKey()],
  )

  const [editingId, setEditingId] = useState<number | null>(null)

  const { pending, error: lastError } = useMutationsStatus(
    updateUser,
    deleteUser,
    removeInvite,
  )

  const handleSubmit = (userId: number) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    const email = fdString(fd, "email").trim()
    if (!name || !email) return
    try {
      await updateUser.mutateAsync({
        id: userId,
        property_id: propertyId,
        name,
        email,
        is_admin: fdBoolean(fd, "is_admin"),
        is_child: fdBoolean(fd, "is_child"),
      })
      setEditingId(null)
    } catch {
      /* surfaced via useMutationsStatus */
    }
  }

  const handleDelete = (userId: number, userName: string) => {
    if (!window.confirm(t('Delete user "{{userName}}"?', { userName }))) return
    deleteUser.mutate({ id: userId })
  }

  const handleRemoveInvite = (inviteId: number, email: string) => {
    if (!window.confirm(t("Remove {{email}} from the allowlist?", { email }))) {
      return
    }
    removeInvite.mutate({ id: inviteId })
  }

  const renderEditForm = (u: (typeof users)[number]) => (
    <form action={handleSubmit(u.id)} key={`edit-${String(u.id)}`}>
      <fieldset>
        <legend>{t("Edit user")}</legend>
        <div>
          <Textfield
            label={t("Name")}
            type="text"
            name="name"
            defaultValue={u.name}
            required
            autoFocus
          />
        </div>
        <div>
          <Textfield
            label={t("Email")}
            type="email"
            name="email"
            defaultValue={u.email}
            required
          />
        </div>
        {isAdmin && (
          <>
            <div>
              <Checkbox
                label={t("Admin")}
                name="is_admin"
                defaultChecked={u.is_admin}
              />
            </div>
            <div>
              <Checkbox
                label={t("Child")}
                name="is_child"
                defaultChecked={u.is_child}
              />
            </div>
          </>
        )}
        <div>
          <SubmitButton>{t("Save")}</SubmitButton>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingId(null)
            }}
            disabled={updateUser.isPending}
          >
            {t("Cancel")}
          </Button>
        </div>
      </fieldset>
    </form>
  )

  return (
    <section>
      <ErrorAlert error={lastError} />

      {users.length === 0 && pendingInvites.length === 0 && !canEdit ? (
        <EmptyState title={t("No users yet.")} />
      ) : (
        <List.Unordered className={styles.list}>
          {canEdit && <AddUserRow />}
          {users.map(u => {
            const roles =
              [u.is_admin ? t("admin") : null, u.is_child ? t("child") : null]
                .filter(Boolean)
                .join(", ") || t("user")
            return (
              <Card asChild key={u.id}>
                <List.Item>
                  <Card.Block>
                    <InlineEditRow
                      editing={editingId === u.id}
                      canEdit={canEdit}
                      pending={pending}
                      editLabel={t("Edit user {{userName}}", {
                        userName: u.name,
                      })}
                      onStartEdit={() => {
                        setEditingId(u.id)
                      }}
                      view={
                        <>
                          <Heading level={4}>{u.name}</Heading>
                          <Paragraph>
                            {u.email}
                            {isSyntheticEmail(u.email) && (
                              <ExclamationmarkTriangleFillIcon
                                title={t(
                                  "Placeholder email — this user can't sign in until it is replaced with a real address.",
                                )}
                                fontSize="1.25em"
                                style={{
                                  color: "var(--ds-color-warning-text-default)",
                                  marginInlineStart: "var(--ds-size-2)",
                                  verticalAlign: "text-bottom",
                                }}
                              />
                            )}
                          </Paragraph>
                          <Paragraph data-size="sm">{roles}</Paragraph>
                        </>
                      }
                      form={renderEditForm(u)}
                      actions={
                        <Button
                          type="button"
                          variant="tertiary"
                          data-color="danger"
                          data-size="sm"
                          disabled={pending}
                          aria-label={t("Delete user {{userName}}", {
                            userName: u.name,
                          })}
                          onClick={() => {
                            handleDelete(u.id, u.name)
                          }}
                        >
                          {t("Delete")}
                        </Button>
                      }
                    />
                  </Card.Block>
                </List.Item>
              </Card>
            )
          })}
          {pendingInvites.map(inv => (
            <Card asChild key={`invite-${String(inv.id)}`}>
              <List.Item>
                <Card.Block>
                  <Heading level={4}>{inv.name ?? inv.email}</Heading>
                  {inv.name != null && <Paragraph>{inv.email}</Paragraph>}
                  <Paragraph>
                    <Tag>{t("Pending")}</Tag>
                    {inv.added_by_name != null && (
                      <span style={{ marginInlineStart: "var(--ds-size-2)" }}>
                        {t("added by {{name}}", { name: inv.added_by_name })}
                      </span>
                    )}
                  </Paragraph>
                  <Button
                    type="button"
                    variant="tertiary"
                    data-color="danger"
                    data-size="sm"
                    disabled={pending}
                    aria-label={t("Remove invite {{email}}", {
                      email: inv.email,
                    })}
                    onClick={() => {
                      handleRemoveInvite(inv.id, inv.email)
                    }}
                  >
                    {t("Remove")}
                  </Button>
                </Card.Block>
              </List.Item>
            </Card>
          ))}
        </List.Unordered>
      )}
    </section>
  )
}
