import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Divider,
  Switch,
  Tag,
} from "@digdir/designsystemet-react"
import { BedIcon, WrenchIcon } from "@navikt/aksel-icons"
import { useTRPC } from "@/trpc/trpc.ts"
import { AddStructureFlow } from "@/features/property/testform/AddStructureFlow.tsx"
import {
  AddBedsFlow,
  type RoomData,
} from "@/features/property/testform/AddBedsFlow.tsx"

type StructureCategory = "habitable" | "non_habitable"

const CATEGORY_LABEL: Record<StructureCategory, string> = {
  habitable: "Habitable",
  non_habitable: "Non-habitable",
}

type OpenForm =
  | { kind: "addRoom"; structureId: number }
  | { kind: "editRoom"; roomId: number }
  | null


export function ListPropertyStructures() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: structures } = useSuspenseQuery(
    trpc.structure.list.queryOptions(),
  )
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())

  const invalidateStructures = () => {
    void qc.invalidateQueries({ queryKey: trpc.structure.list.queryKey() })
  }
  const invalidateRooms = () => {
    void qc.invalidateQueries({ queryKey: trpc.room.list.queryKey() })
  }

  const updateStructure = useMutation(
    trpc.structure.update.mutationOptions({ onSuccess: invalidateStructures }),
  )
  const deleteStructure = useMutation(
    trpc.structure.delete.mutationOptions({ onSuccess: invalidateStructures }),
  )
  const createRoom = useMutation(
    trpc.room.create.mutationOptions({ onSuccess: invalidateRooms }),
  )
  const updateRoom = useMutation(
    trpc.room.update.mutationOptions({ onSuccess: invalidateRooms }),
  )
  const deleteRoom = useMutation(
    trpc.room.delete.mutationOptions({ onSuccess: invalidateRooms }),
  )

  const [openForm, setOpenForm] = useState<OpenForm>(null)
  const [editMode, setEditMode] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingNameId, setEditingNameId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  const propertyStructures = selectedProperty
    ? structures.filter(b => b.property_id === selectedProperty.id)
    : []

  const roomsByStructure = new Map<number, typeof rooms>()
  for (const r of rooms) {
    const list = roomsByStructure.get(r.structure_id) ?? []
    list.push(r)
    roomsByStructure.set(r.structure_id, list)
  }

  const lastError =
    updateStructure.error ??
    deleteStructure.error ??
    createRoom.error ??
    updateRoom.error ??
    deleteRoom.error
  const pending =
    updateStructure.isPending ||
    deleteStructure.isPending ||
    createRoom.isPending ||
    updateRoom.isPending ||
    deleteRoom.isPending

  const toggleAddRoom = (structureId: number) => {
    setOpenForm(v =>
      v?.kind === "addRoom" && v.structureId === structureId
        ? null
        : { kind: "addRoom", structureId },
    )
  }

  const toggleRoomEdit = (roomId: number) => {
    setOpenForm(v =>
      v?.kind === "editRoom" && v.roomId === roomId
        ? null
        : { kind: "editRoom", roomId },
    )
  }

  const handleNameSave = (
    b: { id: number; property_id: number; name: string; category: StructureCategory },
    newName: string,
  ) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === b.name) {
      setEditingNameId(null)
      return
    }
    updateStructure.mutate(
      {
        id: b.id,
        name: trimmed,
        property_id: b.property_id,
        category: b.category,
      },
      { onSuccess: () => { setEditingNameId(null) } },
    )
  }

  const handleDeleteStructure = (structureId: number, structureName: string) => {
    if (!window.confirm(`Delete structure "${structureName}"?`)) return
    deleteStructure.mutate(
      { id: structureId },
      {
        onSuccess: () => {
          setOpenForm(null)
          setExpandedId(null)
        },
      },
    )
  }

  const handleAddRoom =
    (b: { id: number; property_id: number; name: string; category: StructureCategory }) =>
    (data: RoomData) => {
      createRoom.mutate(
        { ...data, structure_id: b.id },
        {
          onSuccess: () => {
            setOpenForm(null)
            if (b.category !== "habitable") {
              updateStructure.mutate({
                id: b.id,
                name: b.name,
                property_id: b.property_id,
                category: "habitable",
              })
            }
          },
        },
      )
    }

  const handleEditRoom =
    (roomId: number, structureId: number) => (data: RoomData) => {
      updateRoom.mutate(
        { id: roomId, structure_id: structureId, ...data },
        { onSuccess: () => { setOpenForm(null) } },
      )
    }

  const handleDeleteRoom = (
    room: { id: number; name: string },
    structure: { id: number; property_id: number; name: string; category: StructureCategory },
    isLastRoom: boolean,
  ) => {
    if (!window.confirm(`Delete room "${room.name}"?`)) return
    deleteRoom.mutate(
      { id: room.id },
      {
        onSuccess: () => {
          setOpenForm(null)
          if (isLastRoom && structure.category !== "non_habitable") {
            updateStructure.mutate({
              id: structure.id,
              name: structure.name,
              property_id: structure.property_id,
              category: "non_habitable",
            })
          }
        },
      },
    )
  }

  if (!selectedProperty) {
    return (
      <section>
        <h3>Structures</h3>
        <p>No property selected. Pick one from the header.</p>
      </section>
    )
  }

  return (
    <section>
      <h3>Structures for {selectedProperty.name}</h3>

      <Switch
        label="Edit mode"
        checked={editMode}
        onChange={e => {
          const next = e.target.checked
          setEditMode(next)
          if (!next) {
            setOpenForm(null)
            setExpandedId(null)
            setEditingNameId(null)
          }
        }}
      />

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      <ul
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "1rem",
          listStyle: "none",
          padding: 0,
        }}
      >
          {propertyStructures.map(b => {
            const structureRooms = roomsByStructure.get(b.id) ?? []
            const isExpanded = expandedId === b.id
            const isEditingName = editingNameId === b.id
            const addRoomOpen =
              openForm?.kind === "addRoom" && openForm.structureId === b.id
            const editingRoom =
              openForm?.kind === "editRoom"
                ? structureRooms.find(r => r.id === openForm.roomId) ?? null
                : null

            return (
              <Card asChild key={b.id}>
                <li
                  style={{
                    flex: "1 1 240px",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Card.Block
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {isEditingName ? (
                        <input
                          type="text"
                          defaultValue={b.name}
                          autoFocus
                          aria-label="structure name"
                          disabled={updateStructure.isPending}
                          onBlur={e => { handleNameSave(b, e.currentTarget.value) }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleNameSave(b, e.currentTarget.value)
                            } else if (e.key === "Escape") {
                              setEditingNameId(null)
                            }
                          }}
                          style={{ flex: 1, minWidth: 0 }}
                        />
                      ) : (
                        <strong
                          onDoubleClick={() => {
                            if (editMode) setEditingNameId(b.id)
                          }}
                          title={
                            editMode ? "Double-click to rename" : undefined
                          }
                          style={{
                            cursor: editMode ? "text" : undefined,
                            userSelect: editMode ? "none" : undefined,
                          }}
                        >
                          {b.name}
                        </strong>
                      )}
                      <Tag
                        data-color={
                          b.category === "habitable" ? "success" : "neutral"
                        }
                        aria-label={CATEGORY_LABEL[b.category]}
                        title={CATEGORY_LABEL[b.category]}
                      >
                        {b.category === "habitable" ? (
                          <BedIcon aria-hidden fontSize="1.25rem" />
                        ) : (
                          <WrenchIcon aria-hidden fontSize="1.25rem" />
                        )}
                      </Tag>
                    </div>

                    {isExpanded && (
                      <>
                        <Divider />

                        {editingRoom ? (
                          <AddBedsFlow
                            key={`edit-room-${String(editingRoom.id)}`}
                            legend={`Edit room ${editingRoom.name}`}
                            submitLabel="Save room"
                            pending={updateRoom.isPending}
                            defaults={{
                              name: editingRoom.name,
                              beds_sm: editingRoom.beds_sm,
                              beds_lg: editingRoom.beds_lg,
                              beds_double: editingRoom.beds_double,
                              beds_kid: editingRoom.beds_kid,
                              mattresses: editingRoom.mattresses,
                              travel_cot: editingRoom.travel_cot,
                            }}
                            onSubmit={handleEditRoom(
                              editingRoom.id,
                              editingRoom.structure_id,
                            )}
                            onCancel={() => { setOpenForm(null) }}
                          />
                        ) : structureRooms.length === 0 ? (
                          <p>No rooms yet.</p>
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
                            {structureRooms.map(r => (
                              <li
                                key={r.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  {r.name}
                                </span>
                                <Button
                                  variant="tertiary"
                                  data-size="sm"
                                  disabled={pending}
                                  onClick={() => { toggleRoomEdit(r.id) }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="tertiary"
                                  data-color="danger"
                                  data-size="sm"
                                  disabled={pending}
                                  onClick={() => {
                                    handleDeleteRoom(
                                      r,
                                      b,
                                      structureRooms.length === 1,
                                    )
                                  }}
                                >
                                  Delete
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <Button
                          variant="secondary"
                          disabled={pending}
                          onClick={() => { toggleAddRoom(b.id) }}
                        >
                          {addRoomOpen ? "Cancel" : "Add room"}
                        </Button>

                        {addRoomOpen && (
                          <AddBedsFlow
                            key={`add-room-${String(b.id)}`}
                            legend={`Add room to ${b.name}`}
                            submitLabel="Save room"
                            pending={createRoom.isPending}
                            onSubmit={handleAddRoom(b)}
                            onCancel={() => { setOpenForm(null) }}
                          />
                        )}

                        <Button
                          variant="secondary"
                          data-color="danger"
                          disabled={pending}
                          onClick={() => { handleDeleteStructure(b.id, b.name) }}
                        >
                          Delete structure
                        </Button>

                        <Button
                          variant="tertiary"
                          style={{
                            marginTop: "auto",
                            alignSelf: "stretch",
                          }}
                          onClick={() => {
                            setExpandedId(null)
                            setOpenForm(null)
                          }}
                        >
                          Close
                        </Button>
                      </>
                    )}

                    {editMode && !isExpanded && (
                      <Button
                        variant="secondary"
                        style={{
                          marginTop: "auto",
                          alignSelf: "stretch",
                        }}
                        disabled={pending}
                        onClick={() => { setExpandedId(b.id) }}
                      >
                        Edit structure
                      </Button>
                    )}
                  </Card.Block>
                </li>
              </Card>
            )
          })}

          <Card asChild key="__add">
            <li
              style={{
                flex: "1 1 240px",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Card.Block
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: "0.5rem",
                }}
              >
                {isAdding ? (
                  <>
                    <strong>Add structure</strong>
                    <AddStructureFlow
                      onAdded={() => { setIsAdding(false) }}
                      onCancel={() => { setIsAdding(false) }}
                    />
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    style={{
                      flex: 1,
                      minHeight: "4rem",
                      alignSelf: "stretch",
                    }}
                    onClick={() => { setIsAdding(true) }}
                  >
                    + Add structure
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        </ul>
    </section>
  )
}
