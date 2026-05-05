import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type AddKind = "user" | "group"

function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  if (typeof v !== "string" || v === "") return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

export function PropertyOwnersPanel() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembers.queryOptions(),
  )

  const ownersQuery = useSuspenseQuery(
    trpc.propertyOwner.list.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const invalidateOwners = () => {
    if (selectedPropertyId == null) return
    void qc.invalidateQueries({
      queryKey: trpc.propertyOwner.list.queryKey({
        property_id: selectedPropertyId,
      }),
    })
  }

  const addUser = useMutation(
    trpc.propertyOwner.addUser.mutationOptions({ onSuccess: invalidateOwners }),
  )
  const addGroup = useMutation(
    trpc.propertyOwner.addGroup.mutationOptions({
      onSuccess: invalidateOwners,
    }),
  )
  const updatePct = useMutation(
    trpc.propertyOwner.updatePct.mutationOptions({
      onSuccess: invalidateOwners,
    }),
  )
  const removeOwner = useMutation(
    trpc.propertyOwner.remove.mutationOptions({ onSuccess: invalidateOwners }),
  )

  const [addOpen, setAddOpen] = useState(false)
  const [addKind, setAddKind] = useState<AddKind>("user")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)

  if (selectedPropertyId == null) {
    return (
      <section>
        <h3>Property Owners</h3>
        <p>No property selected. Pick one from the header.</p>
      </section>
    )
  }

  const owners = ownersQuery.data

  const lastError =
    addUser.error ?? addGroup.error ?? updatePct.error ?? removeOwner.error
  const pending =
    addUser.isPending ||
    addGroup.isPending ||
    updatePct.isPending ||
    removeOwner.isPending

  const totalPct = owners.reduce((s, o) => s + Number(o.ownership_pct), 0)
  const offBy = Math.abs(totalPct - 100)

  const takenUserIds = new Set(
    owners.filter(o => o.user_id != null).map(o => o.user_id as number),
  )
  const takenGroupIds = new Set(
    owners
      .filter(o => o.user_group_id != null)
      .map(o => o.user_group_id as number),
  )
  const availableUsers = users.filter(u => !takenUserIds.has(u.id))
  const availableGroups = groups.filter(g => !takenGroupIds.has(g.id))

  const handleAddSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const pct = fdNumber(fd, "ownership_pct")
    if (!Number.isFinite(pct)) return
    if (addKind === "user") {
      const user_id = fdNumber(fd, "user_id")
      if (!Number.isFinite(user_id)) return
      addUser.mutate(
        { property_id: selectedPropertyId, user_id, ownership_pct: pct },
        {
          onSuccess: () => {
            form.reset()
            setAddOpen(false)
          },
        },
      )
    } else {
      const user_group_id = fdNumber(fd, "user_group_id")
      if (!Number.isFinite(user_group_id)) return
      addGroup.mutate(
        {
          property_id: selectedPropertyId,
          user_group_id,
          ownership_pct: pct,
        },
        {
          onSuccess: () => {
            form.reset()
            setAddOpen(false)
          },
        },
      )
    }
  }

  const handleEditSubmit = (ownerId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const pct = fdNumber(fd, "ownership_pct")
      if (!Number.isFinite(pct)) return
      updatePct.mutate(
        { id: ownerId, property_id: selectedPropertyId, ownership_pct: pct },
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleRemove = (ownerId: number, label: string) => {
    if (!window.confirm(`Remove ${label} as owner?`)) return
    removeOwner.mutate({ id: ownerId, property_id: selectedPropertyId })
  }

  return (
    <section
    >
      <h3>Property Owners</h3>

      <p>
        Total: <strong>{totalPct.toFixed(2)}%</strong>{" "}
        {offBy > 0.001 && (
          <strong role="alert">(does not sum to 100%)</strong>
        )}
      </p>

      <label>
        <input
          type="checkbox"
          checked={editMode}
          onChange={e => {
            const next = e.currentTarget.checked
            setEditMode(next)
            if (!next) {
              setEditingId(null)
              setAddOpen(false)
            }
          }}
        />
        Edit mode
      </label>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {owners.length === 0 ? (
        <p>No owners yet.</p>
      ) : (
        <ul>
          {owners.map(o => {
            const isUser = o.user_id != null
            const label = isUser
              ? (o.user_name ?? `user #${String(o.user_id)}`)
              : (o.user_group_name ?? `group #${String(o.user_group_id)}`)
            const kindLabel = isUser ? "User" : "Group"
            const editing = editingId === o.id
            return (
              <li key={o.id}>
                <strong>{label}</strong> <small>({kindLabel})</small> –{" "}
                {o.ownership_pct}%
                {editMode && (
                  <div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(v => (v === o.id ? null : o.id))
                      }}
                    >
                      {editing ? "Cancel" : "Edit %"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => { handleRemove(o.id, label) }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {editMode && editing && (
                  <form
                    onSubmit={handleEditSubmit(o.id)}
                    key={`edit-${String(o.id)}`}
                  >
                    <fieldset>
                      <legend>Update {label}&apos;s share</legend>
                      <div>
                        <label>
                          Ownership %
                          <input
                            type="number"
                            name="ownership_pct"
                            min={0}
                            max={100}
                            step={0.01}
                            defaultValue={o.ownership_pct}
                            required
                          />
                        </label>
                      </div>
                      <div>
                        <button type="submit" disabled={updatePct.isPending}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingId(null) }}
                          disabled={updatePct.isPending}
                        >
                          Cancel
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editMode && (
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => { setAddOpen(v => !v) }}
          >
            {addOpen ? "Cancel" : "Add owner"}
          </button>
        </div>
      )}

      {editMode && addOpen && (
        <form onSubmit={handleAddSubmit} key={`add-${addKind}`}>
          <fieldset>
            <legend>Add owner</legend>
            <div>
              <label>
                <input
                  type="radio"
                  name="kind"
                  value="user"
                  checked={addKind === "user"}
                  onChange={() => { setAddKind("user") }}
                />
                User
              </label>
              <label>
                <input
                  type="radio"
                  name="kind"
                  value="group"
                  checked={addKind === "group"}
                  onChange={() => { setAddKind("group") }}
                />
                Group
              </label>
            </div>

            {addKind === "user" ? (
              <div>
                <label>
                  User
                  <select name="user_id" required defaultValue="">
                    <option value="" disabled>
                      Select user
                    </option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                {availableUsers.length === 0 && (
                  <p>
                    <em>All users are already owners.</em>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label>
                  Group
                  <select name="user_group_id" required defaultValue="">
                    <option value="" disabled>
                      Select group
                    </option>
                    {availableGroups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.members.length} member
                        {g.members.length === 1 ? "" : "s"})
                      </option>
                    ))}
                  </select>
                </label>
                {availableGroups.length === 0 && (
                  <p>
                    <em>
                      No available groups.{" "}
                      {groups.length === 0
                        ? "Create one from Manage user groups."
                        : "All groups are already owners."}
                    </em>
                  </p>
                )}
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
              <button
                type="submit"
                disabled={
                  pending ||
                  (addKind === "user" && availableUsers.length === 0) ||
                  (addKind === "group" && availableGroups.length === 0)
                }
              >
                Save owner
              </button>
              <button
                type="button"
                onClick={() => { setAddOpen(false) }}
                disabled={pending}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}