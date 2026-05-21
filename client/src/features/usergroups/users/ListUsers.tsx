import { useSelectedPropertyId } from "@/app/useSelectedIds.ts"
import { Fragment, type SyntheticEvent, useEffect, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
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
import { fdBoolean, fdString } from "@/utils/formData.ts"

type ListUsersProps = {
  editMode: boolean
}

export function ListUsers({ editMode }: ListUsersProps) {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0

  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.user.pathKey() })
    void qc.invalidateQueries({ queryKey: trpc.userGroup.pathKey() })
  }

  const updateUser = useMutation(
    trpc.user.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteUser = useMutation(
    trpc.user.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    if (!editMode) setEditingId(null)
  }, [editMode])

  const { pending, error: lastError } = useMutationsStatus(updateUser, deleteUser)

  const handleSubmit = (userId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
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
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleDelete = (userId: number, userName: string) => {
    if (!window.confirm(t("Delete user \"{{userName}}\"?", { userName }))) return
    deleteUser.mutate({ id: userId })
  }

  return (
    <Card asChild>
      <section>
      <Heading level={2}>{t("Users")}</Heading>
      <p>
        {t("Edit user details or remove a user. Deletion is blocked while the user is referenced by any group, ownership, booking, or expense.")}
      </p>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      {users.length === 0 ? (
        <p>{t("No users yet.")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("Name")}</th>
              <th>{t("Email")}</th>
              <th>{t("Role")}</th>
              {editMode && <th>{t("Actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const editing = editingId === u.id
              const roles = [
                u.is_admin ? t("admin") : null,
                u.is_child ? t("child") : null,
              ].filter(Boolean).join(", ") || t("user")
              return (
                <Fragment key={u.id}>
                  <tr>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{roles}</td>
                    {editMode && (
                      <td>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => {
                            setEditingId(v => (v === u.id ? null : u.id))
                          }}
                        >
                          {editing ? t("Cancel") : t("Edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => { handleDelete(u.id, u.name) }}
                        >
                          {t("Delete")}
                        </Button>
                      </td>
                    )}
                  </tr>
                  {editMode && editing && (
                    <tr>
                      <td colSpan={4}>
                        <form onSubmit={handleSubmit(u.id)}>
                          <fieldset>
                            <legend>{t("Edit user")}</legend>
                            <div>
                              <Textfield
                                label={t("Name")}
                                type="text"
                                name="name"
                                defaultValue={u.name}
                                required
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
                                defaultChecked={u.is_child ?? false}
                              />
                            </div>
                            <div>
                              <Button
                                type="submit"
                                disabled={updateUser.isPending}
                              >
                                {t("Save")}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => { setEditingId(null) }}
                                disabled={updateUser.isPending}
                              >
                                {t("Cancel")}
                              </Button>
                            </div>
                          </fieldset>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
      </section>
    </Card>
  )
}
