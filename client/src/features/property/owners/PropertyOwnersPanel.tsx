import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Chip,
  Label,
  Select,
  Switch,
  Tag,
  Textfield,
} from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type AddKind = "user" | "group"

type Owner = {
  id: number
  user_id: number | null
  user_group_id: number | null
  user_name: string | null
  user_group_name: string | null
  ownership_pct: number | string
}

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

  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [addKind, setAddKind] = useState<AddKind>("user")

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

  const ownerLabel = (o: Owner) => {
    const isUser = o.user_id != null
    return isUser
      ? (o.user_name ?? `user #${String(o.user_id)}`)
      : (o.user_group_name ?? `group #${String(o.user_group_id)}`)
  }

  const editingOwner = editingId
    ? owners.find(o => o.id === editingId) ?? null
    : null

  const handleEditSubmit =
    (o: Owner) => (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const pct = fdNumber(fd, "ownership_pct")
      if (!Number.isFinite(pct)) return
      updatePct.mutate(
        { id: o.id, property_id: selectedPropertyId, ownership_pct: pct },
        { onSuccess: () => { setEditingId(null) } },
      )
    }

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
            setIsAdding(false)
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
            setIsAdding(false)
          },
        },
      )
    }
  }

  const handleRemove = (o: Owner) => {
    const label = ownerLabel(o)
    if (!window.confirm(`Remove ${label} as owner?`)) return
    removeOwner.mutate(
      { id: o.id, property_id: selectedPropertyId },
      { onSuccess: () => { setEditingId(null) } },
    )
  }

  const addDisabled =
    pending ||
    (addKind === "user" && availableUsers.length === 0) ||
    (addKind === "group" && availableGroups.length === 0)

  return (
    <section>
      <h3>Property Owners</h3>

      <p>
        Total: <strong>{totalPct.toFixed(2)}%</strong>{" "}
        {offBy > 0.001 && (
          <strong role="alert">(does not sum to 100%)</strong>
        )}
      </p>

      <Switch
        label="Edit mode"
        checked={editMode}
        onChange={e => {
          const next = e.target.checked
          setEditMode(next)
          if (!next) {
            setEditingId(null)
            setIsAdding(false)
          }
        }}
      />

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {editingOwner ? (
        <form
          onSubmit={handleEditSubmit(editingOwner)}
          key={`edit-${String(editingOwner.id)}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <p>
            <strong>{ownerLabel(editingOwner)}</strong>
          </p>
          <Textfield
            label="Ownership %"
            name="ownership_pct"
            type="number"
            min={0}
            max={100}
            step={0.01}
            defaultValue={editingOwner.ownership_pct}
            required
            autoFocus
            disabled={updatePct.isPending}
          />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-color="danger"
              disabled={pending}
              onClick={() => { handleRemove(editingOwner) }}
            >
              Remove
            </Button>
            <Button
              type="button"
              variant="tertiary"
              disabled={pending}
              onClick={() => { setEditingId(null) }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : isAdding ? (
        <form
          onSubmit={handleAddSubmit}
          key={`add-${addKind}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Chip.Radio
              name="kind"
              value="user"
              checked={addKind === "user"}
              onChange={() => { setAddKind("user") }}
            >
              User
            </Chip.Radio>
            <Chip.Radio
              name="kind"
              value="group"
              checked={addKind === "group"}
              onChange={() => { setAddKind("group") }}
            >
              Group
            </Chip.Radio>
          </div>

          {addKind === "user" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <Label htmlFor="add-owner-user">User</Label>
              <Select
                id="add-owner-user"
                name="user_id"
                required
                defaultValue=""
                disabled={pending || availableUsers.length === 0}
              >
                <Select.Option value="" disabled>
                  Select user
                </Select.Option>
                {availableUsers.map(u => (
                  <Select.Option key={u.id} value={String(u.id)}>
                    {u.name}
                  </Select.Option>
                ))}
              </Select>
              {availableUsers.length === 0 && (
                <p>
                  <em>All users are already owners.</em>
                </p>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <Label htmlFor="add-owner-group">Group</Label>
              <Select
                id="add-owner-group"
                name="user_group_id"
                required
                defaultValue=""
                disabled={pending || availableGroups.length === 0}
              >
                <Select.Option value="" disabled>
                  Select group
                </Select.Option>
                {availableGroups.map(g => (
                  <Select.Option key={g.id} value={String(g.id)}>
                    {g.name} ({g.members.length} member
                    {g.members.length === 1 ? "" : "s"})
                  </Select.Option>
                ))}
              </Select>
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

          <Textfield
            label="Ownership %"
            name="ownership_pct"
            type="number"
            min={0}
            max={100}
            step={0.01}
            defaultValue={0}
            required
            disabled={pending}
          />

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={addDisabled}>
              Add owner
            </Button>
            <Button
              type="button"
              variant="tertiary"
              disabled={pending}
              onClick={() => { setIsAdding(false) }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {owners.length === 0 ? (
            <p>No owners yet.</p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {owners.map(o => {
                const isUser = o.user_id != null
                return (
                  <Card asChild key={o.id}>
                    <li>
                      <Card.Block
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {ownerLabel(o)}
                        </span>
                        <Tag data-color={isUser ? "info" : "neutral"}>
                          {isUser ? "User" : "Group"}
                        </Tag>
                        <span>{o.ownership_pct}%</span>
                        {editMode && (
                          <>
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              disabled={pending}
                              onClick={() => { setEditingId(o.id) }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="tertiary"
                              data-color="danger"
                              data-size="sm"
                              disabled={pending}
                              onClick={() => { handleRemove(o) }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </Card.Block>
                    </li>
                  </Card>
                )
              })}
            </ul>
          )}

          {editMode && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => { setIsAdding(true) }}
            >
              + Add owner
            </Button>
          )}
        </>
      )}
    </section>
  )
}
