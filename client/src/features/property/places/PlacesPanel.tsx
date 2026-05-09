import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"

type Props = {
  propertyId: number
  propertyName: string
}

type Place = {
  id: number
  name: string
  description: string
  property_id: number | null
}

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
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
  const updatePlace = useMutation(
    trpc.place.update.mutationOptions({ onSuccess: invalidate }),
  )
  const deletePlace = useMutation(
    trpc.place.delete.mutationOptions({ onSuccess: invalidate }),
  )

  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const lastError =
    createPlace.error ?? updatePlace.error ?? deletePlace.error
  const pending =
    createPlace.isPending || updatePlace.isPending || deletePlace.isPending

  const editingPlace = editingId
    ? places.find(p => p.id === editingId) ?? null
    : null

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
          setIsAdding(false)
        },
      },
    )
  }

  const handleSave =
    (p: Place) => (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      const name = fdString(fd, "name").trim()
      const description = fdString(fd, "description").trim()
      if (!name || !description) return
      updatePlace.mutate(
        { id: p.id, name, description, property_id: propertyId },
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleDelete = (p: Place) => {
    if (!window.confirm(`Delete place "${p.name}"?`)) return
    deletePlace.mutate(
      { id: p.id },
      { onSuccess: () => { setEditingId(null) } },
    )
  }

  return (
    <section>
      <h3>Places at {propertyName}</h3>

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

      {editingPlace ? (
        <form
          onSubmit={handleSave(editingPlace)}
          key={`edit-${String(editingPlace.id)}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <Textfield
            label="Name"
            name="name"
            required
            autoFocus
            defaultValue={editingPlace.name}
            disabled={updatePlace.isPending}
          />
          <Textfield
            label="Description"
            name="description"
            required
            defaultValue={editingPlace.description}
            disabled={updatePlace.isPending}
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
              onClick={() => { handleDelete(editingPlace) }}
            >
              Delete
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
          {places.map(p => (
            <Card asChild key={p.id}>
              <li>
                <Card.Block
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{p.name}</span>
                  {editMode && (
                    <>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { setEditingId(p.id) }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { handleDelete(p) }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </Card.Block>
              </li>
            </Card>
          ))}

          <Card asChild key="__add">
            <li>
              <Card.Block
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {isAdding ? (
                  <>
                    <strong>Add place</strong>
                    <form
                      onSubmit={handleAdd}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <Textfield
                        label="Name"
                        name="name"
                        required
                        autoFocus
                        disabled={createPlace.isPending}
                      />
                      <Textfield
                        label="Description"
                        name="description"
                        required
                        disabled={createPlace.isPending}
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <Button type="submit" disabled={createPlace.isPending}>
                          Add place
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={createPlace.isPending}
                          onClick={() => { setIsAdding(false) }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    style={{
                      flex: 1,
                      minHeight: "4rem",
                      alignSelf: "stretch",
                    }}
                    disabled={pending}
                    onClick={() => { setIsAdding(true) }}
                  >
                    + Add place
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        </ul>
      )}
    </section>
  )
}
