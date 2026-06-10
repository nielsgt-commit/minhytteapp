import { useSelectedPropertyId } from "@/selection/useSelection"
import { type SyntheticEvent, useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
  Heading,
  List,
  Paragraph,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { ExclamationmarkTriangleFillIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation.ts"
import { fdBoolean, fdString } from "@/utils/formData.ts"
import { isSyntheticEmail } from "@/utils/syntheticEmail.ts"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import styles from "./ListUsers.module.css"

type ListUsersProps = {
  canEdit: boolean
  propertyName: string
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

  const userAndGroupKeys = [trpc.user.pathKey(), trpc.userGroup.pathKey()]
  const updateUser = useMutationWithInvalidation(
    trpc.user.update.mutationOptions(),
    userAndGroupKeys,
  )
  const deleteUser = useMutationWithInvalidation(
    trpc.user.delete.mutationOptions(),
    userAndGroupKeys,
  )

  const [editingId, setEditingId] = useState<number | null>(null)

  const { pending, error: lastError } = useMutationsStatus(
    updateUser,
    deleteUser,
  )

  const handleSubmit =
    (userId: number) => (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const name = fdString(fd, "name").trim()
      const email = fdString(fd, "email").trim()
      if (!name || !email) return
      updateUser.mutate(
        {
          id: userId,
          property_id: propertyId,
          name,
          email,
          is_admin: fdBoolean(fd, "is_admin"),
          is_child: fdBoolean(fd, "is_child"),
        },
        {
          onSuccess: () => {
            setEditingId(null)
          },
        },
      )
    }

  const handleDelete = (userId: number, userName: string) => {
    if (!window.confirm(t('Delete user "{{userName}}"?', { userName }))) return
    deleteUser.mutate({ id: userId })
  }

  const renderEditForm = (u: (typeof users)[number]) => (
    <form onSubmit={handleSubmit(u.id)} key={`edit-${String(u.id)}`}>
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
          <Button type="submit" disabled={updateUser.isPending}>
            {t("Save")}
          </Button>
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
      {lastError && (
        <ValidationMessage role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </ValidationMessage>
      )}

      {users.length === 0 ? (
        <Paragraph>{t("No users yet.")}</Paragraph>
      ) : (
        <List.Unordered className={styles.list}>
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
        </List.Unordered>
      )}
    </section>
  )
}
