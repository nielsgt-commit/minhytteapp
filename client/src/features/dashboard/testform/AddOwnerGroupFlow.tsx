import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

function fdOptionalNumber(fd: FormData, key: string): number | null {
  const v = fd.get(key)
  if (typeof v !== "string" || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

type AddSlot = { propertyId: number } | null
type EditSlot = { propertyId: number; userId: number } | null

export function AddOwnerGroupFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: owners } = useSuspenseQuery(
    trpc.propertyOwner.list.queryOptions(),
  )

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.propertyOwner.list.queryKey() })
  }

  const upsertOwner = useMutation(
    trpc.propertyOwner.upsert.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteOwner = useMutation(
    trpc.propertyOwner.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const lastError = upsertOwner.error ?? deleteOwner.error
  const pending = upsertOwner.isPending || deleteOwner.isPending

  const [addSlot, setAddSlot] = useState<AddSlot>(null)
  const [editSlot, setEditSlot] = useState<EditSlot>(null)

  const userById = new Map(users.map(u => [u.id, u]))

  const ownersByProperty = new Map<
    number,
    { user_id: number; ownership_pct: string }[]
  >()
  for (const o of owners) {
    const list = ownersByProperty.get(o.property_id) ?? []
    list.push({ user_id: o.user_id, ownership_pct: o.ownership_pct })
    ownersByProperty.set(o.property_id, list)
  }

  const handleAddSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!addSlot) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const user_id = fdOptionalNumber(fd, "user_id")
    const ownership_pct = fdOptionalNumber(fd, "ownership_pct")
    if (user_id == null || ownership_pct == null) return
    upsertOwner.mutate(
      { property_id: addSlot.propertyId, user_id, ownership_pct },
      {
        onSuccess: () => {
          form.reset()
          setAddSlot(null)
        },
      },
    )
  }

  const handleEditSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editSlot) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const ownership_pct = fdOptionalNumber(fd, "ownership_pct")
    if (ownership_pct == null) return
    upsertOwner.mutate(
      {
        property_id: editSlot.propertyId,
        user_id: editSlot.userId,
        ownership_pct,
      },
      {
        onSuccess: () => {
          form.reset()
          setEditSlot(null)
        },
      },
    )
  }

  const handleRemove = (propertyId: number, userId: number) => {
    if (!window.confirm("Remove this owner from the group?")) return
    deleteOwner.mutate({ property_id: propertyId, user_id: userId })
  }

  return (
    <section>
      <h3>Owner Group Flow</h3>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {properties.length === 0 && <p>No properties yet.</p>}

      <ul>
        {properties.map(p => {
          const group = ownersByProperty.get(p.id) ?? []
          const totalPct = group.reduce(
            (s, o) => s + Number(o.ownership_pct),
            0,
          )
          const addOpen = addSlot?.propertyId === p.id
          const availableUsers = users.filter(
            u => !group.some(o => o.user_id === u.id),
          )

          return (
            <li key={p.id}>
              <h4>
                {p.name} <small>({p.address})</small>
              </h4>
              <p>
                Owners: {group.length} – total {totalPct.toFixed(2)}%
                {Math.abs(totalPct - 100) > 0.001 && (
                  <strong> (does not sum to 100%)</strong>
                )}
              </p>

              {group.length === 0 ? (
                <p>No owners yet.</p>
              ) : (
                <ul>
                  {group.map(o => {
                    const user = userById.get(o.user_id)
                    const isEditing =
                      editSlot?.propertyId === p.id &&
                      editSlot.userId === o.user_id
                    return (
                      <li key={o.user_id}>
                        {user?.name ?? `user #${String(o.user_id)}`} –{" "}
                        {o.ownership_pct}%
                        <div>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              setEditSlot(v =>
                                v?.propertyId === p.id &&
                                v.userId === o.user_id
                                  ? null
                                  : { propertyId: p.id, userId: o.user_id },
                              )
                            }}
                          >
                            {isEditing ? "Cancel edit" : "Edit %"}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              handleRemove(p.id, o.user_id)
                            }}
                          >
                            Remove
                          </button>
                        </div>
                        {isEditing && (
                          <EditPctForm
                            key={`edit-${String(p.id)}-${String(o.user_id)}`}
                            defaultPct={o.ownership_pct}
                            pending={upsertOwner.isPending}
                            onSubmit={handleEditSubmit}
                            onCancel={() => {
                              setEditSlot(null)
                            }}
                          />
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
                    setAddSlot(v =>
                      v?.propertyId === p.id ? null : { propertyId: p.id },
                    )
                  }}
                >
                  {addOpen ? "Cancel" : "Add owner"}
                </button>
              </div>

              {addOpen && (
                <AddOwnerForm
                  key={`add-${String(p.id)}`}
                  propertyName={p.name}
                  candidates={availableUsers}
                  pending={upsertOwner.isPending}
                  onSubmit={handleAddSubmit}
                  onCancel={() => {
                    setAddSlot(null)
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

function AddOwnerForm({
  propertyName,
  candidates,
  pending,
  onSubmit,
  onCancel,
}: {
  propertyName: string
  candidates: { id: number; name: string }[]
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>Add owner to {propertyName}</legend>
        {candidates.length === 0 ? (
          <p>All users are already owners of this property.</p>
        ) : (
          <div>
            <label>
              User
              <select name="user_id" required defaultValue="">
                <option value="" disabled>
                  Select user
                </option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
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
          <button type="submit" disabled={pending || candidates.length === 0}>
            Save owner
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}

function EditPctForm({
  defaultPct,
  pending,
  onSubmit,
  onCancel,
}: {
  defaultPct: string
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>Edit ownership %</legend>
        <div>
          <label>
            Ownership %
            <input
              type="number"
              name="ownership_pct"
              min={0}
              max={100}
              step={0.01}
              defaultValue={defaultPct}
              required
            />
          </label>
        </div>
        <div>
          <button type="submit" disabled={pending}>
            Update
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}