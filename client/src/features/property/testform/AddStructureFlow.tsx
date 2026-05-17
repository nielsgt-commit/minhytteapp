import { type SyntheticEvent } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Textfield } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"

type Props = {
  onAdded?: () => void
  onCancel?: () => void
}

export function AddStructureFlow({ onAdded, onCancel }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const invalidateStructures = () => {
    void qc.invalidateQueries({ queryKey: trpc.structure.list.queryKey() })
  }

  const createStructure = useMutation(
    trpc.structure.create.mutationOptions({ onSuccess: invalidateStructures }),
  )

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  const handleAddStructure = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProperty) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    createStructure.mutate(
      { name, property_id: selectedProperty.id },
      {
        onSuccess: () => {
          form.reset()
          onAdded?.()
        },
      },
    )
  }

  if (!selectedProperty) {
    return <p>No property selected. Pick one from the header.</p>
  }

  return (
    <>
      {createStructure.error && (
        <p role="alert">Error: {createStructure.error.message}</p>
      )}

      <form
        onSubmit={handleAddStructure}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <Textfield
          label="Name"
          name="name"
          required
          autoFocus
          disabled={createStructure.isPending}
        />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="submit" disabled={createStructure.isPending}>
            Add structure
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="tertiary"
              disabled={createStructure.isPending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </>
  )
}
