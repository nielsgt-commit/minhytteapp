import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppDispatch, useAppSelector } from "@/app/hooks.ts"
import {
  selectSelectedPropertyId,
  setSelectedPropertyId,
} from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function DeletePropertyFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const dispatch = useAppDispatch()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const deleteProperty = useMutation(
    trpc.property.delete.mutationOptions({
      onSuccess: () => {
        dispatch(setSelectedPropertyId(null))
        void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
        void qc.invalidateQueries({
          queryKey: trpc.property.listForUser.queryKey(),
        })
      },
    }),
  )

  const [isArmed, setIsArmed] = useState(false)
  const [typedName, setTypedName] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  if (!selectedProperty) {
    return <p>No property selected.</p>
  }

  const nameMatches = typedName === selectedProperty.name
  const canDelete =
    nameMatches && acknowledged && !deleteProperty.isPending

  const reset = () => {
    setIsArmed(false)
    setTypedName("")
    setAcknowledged(false)
  }

  const handleDelete = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canDelete) return
    deleteProperty.mutate(
      { id: selectedProperty.id },
      { onSuccess: reset },
    )
  }

  if (!isArmed) {
    return (
      <div>
        <h4>Delete property</h4>
        <p>
          Permanently delete <strong>{selectedProperty.name}</strong> and all
          data associated with it.
        </p>
        <button type="button" onClick={() => { setIsArmed(true) }}>
          Delete this property…
        </button>
      </div>
    )
  }

  return (
    <div>
      <h4>Delete property</h4>

      <p role="alert">
        <strong>Warning:</strong> This action cannot be undone. Deleting{" "}
        <strong>{selectedProperty.name}</strong> will permanently remove the
        property along with all its Structures, rooms, bookings, and history.
      </p>

      <form onSubmit={handleDelete}>
        <fieldset>
          <legend>Confirm deletion</legend>

          <div>
            <label>
              Type <strong>{selectedProperty.name}</strong> to confirm
              <input
                type="text"
                value={typedName}
                onChange={e => { setTypedName(e.target.value) }}
                autoComplete="off"
                autoFocus
                required
              />
            </label>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => { setAcknowledged(e.target.checked) }}
              />
              I understand that this action is permanent and cannot be undone.
            </label>
          </div>

          <div>
            <button type="submit" disabled={!canDelete}>
              Permanently delete {selectedProperty.name}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={deleteProperty.isPending}
            >
              Cancel
            </button>
          </div>

          {deleteProperty.error && (
            <p role="alert">Error: {deleteProperty.error.message}</p>
          )}
        </fieldset>
      </form>
    </div>
  )
}