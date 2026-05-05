import { Fragment, type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdBoolean(fd: FormData, key: string): boolean {
  return fd.get(key) === "on"
}

export function ListUsers() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })
    void qc.invalidateQueries({
      queryKey: trpc.userGroup.listWithMembers.queryKey(),
    })
  }

  const updateUser = useMutation(
    trpc.user.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteUser = useMutation(
    trpc.user.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)

  const lastError = updateUser.error ?? deleteUser.error
  const pending = updateUser.isPending || deleteUser.isPending

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
    <section>
      <h2>Users</h2>
      <p>
        Edit user details or remove a user. Deletion is blocked while the user
        is referenced by any group, ownership, booking, or expense.
      </p>

      <label>
        <input
          type="checkbox"
          checked={editMode}
          onChange={e => {
            const next = e.currentTarget.checked
            setEditMode(next)
            if (!next) setEditingId(null)
          }}
        />
        Edit mode
      </label>

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
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setEditingId(v => (v === u.id ? null : u.id))
                          }}
                        >
                          {editing ? "Cancel" : "Edit"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => { handleDelete(u.id, u.name) }}
                        >
                          Delete
                        </button>
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
                              <label>
                                Name
                                <input
                                  type="text"
                                  name="name"
                                  defaultValue={u.name}
                                  required
                                />
                              </label>
                            </div>
                            <div>
                              <label>
                                Email
                                <input
                                  type="email"
                                  name="email"
                                  defaultValue={u.email}
                                  required
                                />
                              </label>
                            </div>
                            <div>
                              <label>
                                <input
                                  type="checkbox"
                                  name="is_admin"
                                  defaultChecked={u.is_admin}
                                />
                                Admin
                              </label>
                            </div>
                            <div>
                              <label>
                                <input
                                  type="checkbox"
                                  name="is_child"
                                  defaultChecked={u.is_child ?? false}
                                />
                                Child
                              </label>
                            </div>
                            <div>
                              <button
                                type="submit"
                                disabled={updateUser.isPending}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingId(null) }}
                                disabled={updateUser.isPending}
                              >
                                Cancel
                              </button>
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
  )
}