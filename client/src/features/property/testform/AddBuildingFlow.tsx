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

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

type Props = {
  onAdded?: () => void
  onCancel?: () => void
}

export function AddBuildingFlow({ onAdded, onCancel }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const invalidateBuildings = () => {
    void qc.invalidateQueries({ queryKey: trpc.building.list.queryKey() })
  }

  const createBuilding = useMutation(
    trpc.building.create.mutationOptions({ onSuccess: invalidateBuildings }),
  )

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  const handleAddBuilding = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProperty) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    createBuilding.mutate(
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
      {createBuilding.error && (
        <p role="alert">Error: {createBuilding.error.message}</p>
      )}

      <form
        onSubmit={handleAddBuilding}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <Textfield
          label="Name"
          name="name"
          required
          autoFocus
          disabled={createBuilding.isPending}
        />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="submit" disabled={createBuilding.isPending}>
            Add building
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="tertiary"
              disabled={createBuilding.isPending}
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
