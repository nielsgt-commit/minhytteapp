import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  return typeof v === "string" ? Number(v) : 0
}

function fdBoolean(fd: FormData, key: string): boolean {
  return fd.get(key) === "on"
}

function fdOptionalNumber(fd: FormData, key: string): number | null {
  const v = fd.get(key)
  if (typeof v !== "string" || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

type UserFormSlot = { id: number | null } | null
type OwnerFormSlot = { userId: number } | null

export function AddUserFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: owners } = useSuspenseQuery(
    trpc.propertyOwner.list.queryOptions(),
  )

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.propertyOwner.list.queryKey() })
  }

  const createUser = useMutation(
    trpc.user.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const updateUser = useMutation(
    trpc.user.update.mutationOptions({ onSuccess: invalidateAll }),
  )
  const deleteUser = useMutation(
    trpc.user.delete.mutationOptions({ onSuccess: invalidateAll }),
  )

  const upsertOwner = useMutation(
    trpc.propertyOwner.upsert.mutationOptions({ onSuccess: invalidateAll }),
  )
  const deleteOwner = useMutation(
    trpc.propertyOwner.delete.mutationOptions({ onSuccess: invalidateAll }),
  )

  const lastError =
    createUser.error ??
    updateUser.error ??
    deleteUser.error ??
    upsertOwner.error ??
    deleteOwner.error

  const userPending =
    createUser.isPending || updateUser.isPending || deleteUser.isPending

  const [userForm, setUserForm] = useState<UserFormSlot>(null)
  const [ownerForm, setOwnerForm] = useState<OwnerFormSlot>(null)

  const closeUserForm = () => {
    setUserForm(null)
  }

  const userById = new Map(users.map(u => [u.id, u]))

  const ownersByUser = new Map<
    number,
    { property_id: number; ownership_pct: string }[]
  >()
  const ownersByProperty = new Map<
    number,
    { user_id: number; ownership_pct: string }[]
  >()
  for (const o of owners) {
    const byUser = ownersByUser.get(o.user_id) ?? []
    byUser.push({
      property_id: o.property_id,
      ownership_pct: o.ownership_pct,
    })
    ownersByUser.set(o.user_id, byUser)
    const byProp = ownersByProperty.get(o.property_id) ?? []
    byProp.push({ user_id: o.user_id, ownership_pct: o.ownership_pct })
    ownersByProperty.set(o.property_id, byProp)
  }

  const handleUserSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name")
    const email = fdString(fd, "email")
    const is_admin = fdBoolean(fd, "is_admin")
    const is_child = fdBoolean(fd, "is_child")

    const id = userForm?.id ?? null
    const opts = {
      onSuccess: () => {
        form.reset()
        setUserForm(null)
      },
    }

    const payload = { name, email, is_admin, is_child }
    if (id == null) createUser.mutate(payload, opts)
    else updateUser.mutate({ id, ...payload }, opts)
  }

  const handleDeleteUser = (id: number) => {
    if (!window.confirm("Delete this user?")) return
    deleteUser.mutate({ id })
  }

  const handleOwnerSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!ownerForm) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const property_id = fdOptionalNumber(fd, "property_id")
    const ownership_pct = fdNumber(fd, "ownership_pct")
    if (property_id == null) return
    upsertOwner.mutate(
      { property_id, user_id: ownerForm.userId, ownership_pct },
      {
        onSuccess: () => {
          form.reset()
          setOwnerForm(null)
        },
      },
    )
  }

  const handleDeleteOwner = (userId: number, propertyId: number) => {
    if (!window.confirm("Remove ownership?")) return
    deleteOwner.mutate({ user_id: userId, property_id: propertyId })
  }

  const isCreateUserOpen = userForm?.id === null
  const editingUserId = userForm?.id ?? null

  return (
    <section>
      <h3>Add User Flow</h3>

      <div>
        <button
          type="button"
          onClick={() => {
            setUserForm(v => (v?.id === null ? null : { id: null }))
          }}
        >
          {isCreateUserOpen ? "Cancel" : "Add new user"}
        </button>
      </div>

      {isCreateUserOpen && (
        <UserForm
          key="user-create"
          legend="New user"
          submitLabel="Create user"
          pending={userPending}
          onSubmit={handleUserSubmit}
          onCancel={closeUserForm}
        />
      )}

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {users.length === 0 && <p>No users yet.</p>}

      <ul>
        {users.map(u => {
          const userOwnerships = ownersByUser.get(u.id) ?? []
          const isOwner = userOwnerships.length > 0

          const userIsEditing = editingUserId === u.id
          const ownerFormOpen = ownerForm?.userId === u.id

          return (
            <li key={u.id}>
              <h4>
                {u.name} <small>({u.email})</small>
              </h4>
              <ul>
                <li>Privilege: {u.is_admin ? "admin" : "user"}</li>
                <li>Is child: {u.is_child ? "yes" : "no"}</li>
                <li>Property owner: {isOwner ? "true" : "false"}</li>
              </ul>

              {userOwnerships.length > 0 && (
                <ul>
                  {userOwnerships.map(o => {
                    const prop = properties.find(p => p.id === o.property_id)
                    const otherOwners = (
                      ownersByProperty.get(o.property_id) ?? []
                    ).filter(ow => ow.user_id !== u.id)
                    return (
                      <li key={o.property_id}>
                        <strong>{prop?.name ?? `#${String(o.property_id)}`}</strong>{" "}
                        – {o.ownership_pct}%
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteOwner(u.id, o.property_id)
                          }}
                        >
                          Remove
                        </button>
                        {otherOwners.length > 0 && (
                          <ul>
                            {otherOwners.map(ow => {
                              const other = userById.get(ow.user_id)
                              return (
                                <li key={ow.user_id}>
                                  {other?.name ?? `user #${String(ow.user_id)}`}{" "}
                                  – {ow.ownership_pct}%
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setUserForm(v => (v?.id === u.id ? null : { id: u.id }))
                  }}
                  disabled={userPending}
                >
                  {userIsEditing ? "Cancel edit" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteUser(u.id)
                  }}
                  disabled={userPending}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOwnerForm(v =>
                      v?.userId === u.id ? null : { userId: u.id },
                    )
                  }}
                >
                  {ownerFormOpen ? "Cancel owner" : "Add property ownership"}
                </button>
              </div>

              {userIsEditing && (
                <UserForm
                  key={`user-edit-${String(u.id)}`}
                  legend={`Edit user #${String(u.id)}`}
                  submitLabel="Update user"
                  pending={userPending}
                  defaults={{
                    name: u.name,
                    email: u.email,
                    is_admin: u.is_admin,
                    is_child: u.is_child ?? false,
                  }}
                  onSubmit={handleUserSubmit}
                  onCancel={closeUserForm}
                />
              )}

              {ownerFormOpen && (
                <OwnerFormBlock
                  key={`owner-${String(u.id)}`}
                  userName={u.name}
                  pending={upsertOwner.isPending}
                  properties={properties}
                  onSubmit={handleOwnerSubmit}
                  onCancel={() => {
                    setOwnerForm(null)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type UserDefaults = {
  name: string
  email: string
  is_admin: boolean
  is_child: boolean
}

function UserForm({
  legend,
  submitLabel,
  pending,
  defaults,
  onSubmit,
  onCancel,
}: {
  legend: string
  submitLabel: string
  pending: boolean
  defaults?: UserDefaults
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>{legend}</legend>
        <div>
          <label>
            Name
            <input
              type="text"
              name="name"
              defaultValue={defaults?.name ?? ""}
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
              defaultValue={defaults?.email ?? ""}
              required
            />
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="is_admin"
              defaultChecked={defaults?.is_admin ?? true}
            />
            Admin
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="is_child"
              defaultChecked={defaults?.is_child ?? false}
            />
            Is child
          </label>
        </div>
        <div>
          <button type="submit" disabled={pending}>
            {submitLabel}
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}

function OwnerFormBlock({
  userName,
  pending,
  properties,
  onSubmit,
  onCancel,
}: {
  userName: string
  pending: boolean
  properties: { id: number; name: string }[]
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>Property ownership for {userName}</legend>
        <div>
          <label>
            Property
            <select name="property_id" required defaultValue="">
              <option value="" disabled>
                Select property
              </option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
          <button type="submit" disabled={pending}>
            Save ownership
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}