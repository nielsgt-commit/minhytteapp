import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

type Props = {
  propertyId: number
  propertyName: string
}

export function PlacesPanel({ propertyId, propertyName }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: places } = useSuspenseQuery(
    trpc.place.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.place.listForProperty.queryKey({
        property_id: propertyId,
      }),
    })
  }

  const createPlace = useMutation(
    trpc.place.create.mutationOptions({ onSuccess: invalidate }),
  )

  const [isAddOpen, setIsAddOpen] = useState(false)

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const description = fdString(fd, "description").trim()
    if (!name || !description) return
    createPlace.mutate(
      { name, description, property_id: propertyId },
      {
        onSuccess: () => {
          form.reset()
          setIsAddOpen(false)
        },
      },
    )
  }

  return (
    <section>
      <h3>Places at {propertyName}</h3>

      {createPlace.error && (
        <p role="alert">Error: {createPlace.error.message}</p>
      )}

      {places.length === 0 ? (
        <p>No places yet.</p>
      ) : (
        <ul>
          {places.map(p => (
            <li key={p.id}>
              <strong>{p.name}</strong> — {p.description}
            </li>
          ))}
        </ul>
      )}

      {isAddOpen ? (
        <form onSubmit={handleAdd}>
          <fieldset>
            <legend>Add place</legend>
            <div>
              <label>
                Name
                <input type="text" name="name" required autoFocus />
              </label>
            </div>
            <div>
              <label>
                Description
                <input type="text" name="description" required />
              </label>
            </div>
            <div>
              <button type="submit" disabled={createPlace.isPending}>
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false)
                }}
                disabled={createPlace.isPending}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsAddOpen(true)
          }}
        >
          Add place
        </button>
      )}
    </section>
  )
}