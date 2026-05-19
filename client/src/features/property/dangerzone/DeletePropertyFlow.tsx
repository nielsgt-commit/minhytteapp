import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Checkbox,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"
import { useAppDispatch } from "@/app/hooks.ts"
import { setSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function DeletePropertyFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const dispatch = useAppDispatch()

  const selectedPropertyId = useSelectedPropertyId()

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
        <Button type="button" onClick={() => { setIsArmed(true) }}>
          Delete this property…
        </Button>
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
        <Fieldset>
          <Fieldset.Legend>Confirm deletion</Fieldset.Legend>

          <div>
            <Textfield
              label={
                <>
                  Type <strong>{selectedProperty.name}</strong> to confirm
                </>
              }
              type="text"
              value={typedName}
              onChange={e => { setTypedName(e.target.value) }}
              autoComplete="off"
              autoFocus
              required
            />
          </div>

          <div>
            <Checkbox
              label="I understand that this action is permanent and cannot be undone."
              checked={acknowledged}
              onChange={e => { setAcknowledged(e.target.checked) }}
            />
          </div>

          <div>
            <Button type="submit" disabled={!canDelete}>
              Permanently delete {selectedProperty.name}
            </Button>
            <Button
              type="button"
              onClick={reset}
              disabled={deleteProperty.isPending}
            >
              Cancel
            </Button>
          </div>

          {deleteProperty.error && (
            <p role="alert">Error: {deleteProperty.error.message}</p>
          )}
        </Fieldset>
      </form>
    </div>
  )
}
