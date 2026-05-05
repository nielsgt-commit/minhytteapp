import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import PropertyContacts from "./PropertyContacts.tsx"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

export default function PropertyInfo() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const updateProperty = useMutation(
    trpc.property.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
      },
    }),
  )

  const [isEditing, setIsEditing] = useState(false)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  if (!selectedProperty) {
    return (
      <>
        <h1>Property Info</h1>
        <p>No property selected. Pick one from the header.</p>
      </>
    )
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const address = fdString(fd, "address").trim()
    if (!name || !address) return
    const linkRaw = fdString(fd, "link").trim()
    const parkingRaw = fdString(fd, "parking_spots").trim()
    const parkingNum = parkingRaw === "" ? 0 : Number(parkingRaw)
    updateProperty.mutate(
      {
        id: selectedProperty.id,
        name,
        address,
        link: linkRaw === "" ? null : linkRaw,
        parking_spots: Number.isFinite(parkingNum) ? parkingNum : 0,
      },
      { onSuccess: () => { setIsEditing(false) } },
    )
  }

  if (isEditing) {
    return (
      <>
        <h1>Property Info</h1>
        {updateProperty.error && (
          <p role="alert">Error: {updateProperty.error.message}</p>
        )}
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Edit property</legend>
            <div>
              <label>
                Name
                <input
                  type="text"
                  name="name"
                  defaultValue={selectedProperty.name}
                  required
                />
              </label>
            </div>
            <div>
              <label>
                Address
                <input
                  type="text"
                  name="address"
                  defaultValue={selectedProperty.address}
                  required
                />
              </label>
            </div>
            <div>
              <label>
                Link
                <input
                  type="text"
                  name="link"
                  defaultValue={selectedProperty.link ?? ""}
                />
              </label>
            </div>
            <div>
              <label>
                Parking spots
                <input
                  type="number"
                  name="parking_spots"
                  min={0}
                  max={99}
                  defaultValue={selectedProperty.parking_spots}
                />
              </label>
            </div>
            <div>
              <button type="submit" disabled={updateProperty.isPending}>
                Save
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false) }}
                disabled={updateProperty.isPending}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      </>
    )
  }

  return (
    <>
      <h1>Property Info</h1>
      <p>{selectedProperty.name}</p>
      <p>{selectedProperty.address}</p>
      <p>
        Link:{" "}
        {selectedProperty.link != null && selectedProperty.link !== "" ? (
          <a href={selectedProperty.link} target="_blank" rel="noreferrer">
            {selectedProperty.link}
          </a>
        ) : (
          <em>none</em>
        )}
      </p>
      <p> coordinates / matrix </p>
      <p> Property description </p>
      <p>Parking spots: {selectedProperty.parking_spots}</p>

      <button type="button" onClick={() => { setIsEditing(true) }}>
        Edit property details
      </button>

      <PropertyContacts />
    </>
  )
}
