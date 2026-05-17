import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Switch } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdNumber } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import {
  ownerLabel,
  ownershipOffBy,
  totalOwnershipPct,
} from "./ownershipCalculations.ts"
import { OwnerListView } from "./OwnerListView.tsx"
import { OwnerEditForm } from "./OwnerEditForm.tsx"
import { OwnerAddForm } from "./OwnerAddForm.tsx"

type AddKind = "user" | "group"

type Owner = {
  id: number
  user_id: number | null
  user_group_id: number | null
  user_name: string | null
  user_group_name: string | null
  ownership_pct: number | string
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

  const { pending, error: lastError } = useMutationsStatus(
    addUser,
    addGroup,
    updatePct,
    removeOwner,
  )

  if (selectedPropertyId == null) {
    return (
      <section>
        <h3>Property Owners</h3>
        <p>No property selected. Pick one from the header.</p>
      </section>
    )
  }

  const owners = ownersQuery.data

  const totalPct = totalOwnershipPct(owners)
  const offBy = ownershipOffBy(owners)

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
        <OwnerEditForm
          owner={editingOwner}
          pending={pending}
          updatePending={updatePct.isPending}
          onSubmit={handleEditSubmit(editingOwner)}
          onRemove={() => { handleRemove(editingOwner) }}
          onCancel={() => { setEditingId(null) }}
        />
      ) : isAdding ? (
        <OwnerAddForm
          addKind={addKind}
          pending={pending}
          addDisabled={addDisabled}
          availableUsers={availableUsers}
          availableGroups={availableGroups}
          totalGroups={groups.length}
          onKindChange={kind => { setAddKind(kind) }}
          onSubmit={handleAddSubmit}
          onCancel={() => { setIsAdding(false) }}
        />
      ) : (
        <OwnerListView
          owners={owners}
          editMode={editMode}
          pending={pending}
          onEdit={id => { setEditingId(id) }}
          onRemove={handleRemove}
          onStartAdd={() => { setIsAdding(true) }}
        />
      )}
    </section>
  )
}
