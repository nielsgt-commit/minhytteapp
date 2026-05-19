import { useSelectedPropertyId } from "@/app/useSelectedIds.ts"
import { Fragment, type SyntheticEvent, useState } from "react"
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
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus.ts"
import { fdBoolean, fdString } from "@/utils/formData.ts"

export function ListUsers() {
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
  const [editMode, setEditMode] = useState(false)

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
    if (!window.confirm(`Delete user "${userName}"?`)) return
    deleteUser.mutate({ id: userId })
  }

  return (
    <Card asChild>
      <section>
      <Heading level={2}>Users</Heading>
      <p>
        Edit user details or remove a user. Deletion is blocked while the user
        is referenced by any group, ownership, booking, or expense.
      </p>

      <Checkbox
        label="Edit mode"
        checked={editMode}
        onChange={e => {
          const next = e.currentTarget.checked
          setEditMode(next)
          if (!next) setEditingId(null)
        }}
      />

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {users.length === 0 ? (
        <p>No users yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              {editMode && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const editing = editingId === u.id
              const roles = [
                u.is_admin ? "admin" : null,
                u.is_child ? "child" : null,
              ].filter(Boolean).join(", ") || "user"
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
                          {editing ? "Cancel" : "Edit"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => { handleDelete(u.id, u.name) }}
                        >
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                  {editMode && editing && (
                    <tr>
                      <td colSpan={4}>
                        <form onSubmit={handleSubmit(u.id)}>
                          <fieldset>
                            <legend>Edit user</legend>
                            <div>
                              <Textfield
                                label="Name"
                                type="text"
                                name="name"
                                defaultValue={u.name}
                                required
                              />
                            </div>
                            <div>
                              <Textfield
                                label="Email"
                                type="email"
                                name="email"
                                defaultValue={u.email}
                                required
                              />
                            </div>
                            <div>
                              <Checkbox
                                label="Admin"
                                name="is_admin"
                                defaultChecked={u.is_admin}
                              />
                            </div>
                            <div>
                              <Checkbox
                                label="Child"
                                name="is_child"
                                defaultChecked={u.is_child ?? false}
                              />
                            </div>
                            <div>
                              <Button
                                type="submit"
                                disabled={updateUser.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => { setEditingId(null) }}
                                disabled={updateUser.isPending}
                              >
                                Cancel
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
