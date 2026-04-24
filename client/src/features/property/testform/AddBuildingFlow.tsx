import { type SyntheticEvent } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

export function AddBuildingFlow() {
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
      { onSuccess: () => { form.reset() } },
    )
  }

  return (
    <section>
      <h3>Add Building Flow</h3>

      {createBuilding.error && (
        <p role="alert">Error: {createBuilding.error.message}</p>
      )}

      {!selectedProperty ? (
        <p>No property selected. Pick one from the header.</p>
      ) : (
        <>
          <p>
            Adding to: <strong>{selectedProperty.name}</strong>{" "}
            <small>({selectedProperty.address})</small>
          </p>

          <form onSubmit={handleAddBuilding}>
            <fieldset>
              <legend>New building</legend>
              <div>
                <label>
                  Name
                  <input type="text" name="name" required />
                </label>
              </div>
              <div>
                <button type="submit" disabled={createBuilding.isPending}>
                  Add building
                </button>
              </div>
            </fieldset>
          </form>
        </>
      )}
    </section>
  )
}