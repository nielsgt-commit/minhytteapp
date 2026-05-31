import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { type SyntheticEvent, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
  Heading,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation.ts"
import { fdBoolean, fdString } from "@/utils/formData.ts"
import { InlineEditRow } from "@/components/shared/InlineEditRow"

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
    <Card asChild>
      <section>
        <Heading level={2}>{t("Users")}</Heading>
        <p>
          {t(
            "Edit user details or remove a user. Deletion is blocked while the user is referenced by any group, ownership, booking, or expense.",
          )}
        </p>

        {lastError && (
          <p role="alert">
            {t("Error: {{message}}", { message: lastError.message })}
          </p>
        )}

        {users.length === 0 ? (
          <p>{t("No users yet.")}</p>
        ) : (
          <ul>
            {users.map(u => {
              const roles =
                [u.is_admin ? t("admin") : null, u.is_child ? t("child") : null]
                  .filter(Boolean)
                  .join(", ") || t("user")
              return (
                <Card asChild key={u.id}>
                  <li>
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
                            <p>{u.email}</p>
                            <p>
                              <small>{roles}</small>
                            </p>
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
                  </li>
                </Card>
              )
            })}
          </ul>
        )}
      </section>
    </Card>
  )
}
