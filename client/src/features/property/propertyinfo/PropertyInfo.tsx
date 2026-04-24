import { type SyntheticEvent, useState } from "react"
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

export default function PropertyInfo() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: userGroups } = useSuspenseQuery(
    trpc.userGroup.list.queryOptions(),
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

  const ownerGroup =
    selectedProperty.owner_group_id != null
      ? userGroups.find(g => g.id === selectedProperty.owner_group_id)
      : null

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    const address = fdString(fd, "address").trim()
    if (!name || !address) return
    const linkRaw = fdString(fd, "link").trim()
    const ownerGroupIdRaw = fdString(fd, "owner_group_id")
    const owner_group_id =
      ownerGroupIdRaw === "" ? null : Number(ownerGroupIdRaw)
    updateProperty.mutate(
      {
        id: selectedProperty.id,
        name,
        address,
        link: linkRaw === "" ? null : linkRaw,
        owner_group_id,
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
                Owner group
                <select
                  name="owner_group_id"
                  defaultValue={
                    selectedProperty.owner_group_id != null
                      ? String(selectedProperty.owner_group_id)
                      : ""
                  }
                >
                  <option value="">None</option>
                  {userGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
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
      <p>
        Owner group: {ownerGroup ? ownerGroup.name : <em>none</em>}
      </p>
      <p> coordinates / matrix </p>
      <p> Property description </p>
      <p> facilities (parking ) </p>

      <button type="button" onClick={() => { setIsEditing(true) }}>
        Edit property details
      </button>
    </>
  )
}