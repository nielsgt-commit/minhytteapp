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
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { AddBuildingFlow } from "@/features/property/testform/AddBuildingFlow.tsx"
import {
  AddBedsFlow,
  type RoomData,
} from "@/features/property/testform/AddBedsFlow.tsx"

type BuildingCategory = "habitable" | "non_habitable"

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  habitable: "Habitable",
  non_habitable: "Non-habitable",
}

type OpenForm =
  | { kind: "addRoom"; buildingId: number }
  | { kind: "editRoom"; roomId: number }
  | null


export function ListPropertyBuildings() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())

  const invalidateBuildings = () => {
    void qc.invalidateQueries({ queryKey: trpc.building.list.queryKey() })
  }
  const invalidateRooms = () => {
    void qc.invalidateQueries({ queryKey: trpc.room.list.queryKey() })
  }

  const updateBuilding = useMutation(
    trpc.building.update.mutationOptions({ onSuccess: invalidateBuildings }),
  )
  const deleteBuilding = useMutation(
    trpc.building.delete.mutationOptions({ onSuccess: invalidateBuildings }),
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

  const propertyBuildings = selectedProperty
    ? buildings.filter(b => b.property_id === selectedProperty.id)
    : []

  const roomsByBuilding = new Map<number, typeof rooms>()
  for (const r of rooms) {
    const list = roomsByBuilding.get(r.building_id) ?? []
    list.push(r)
    roomsByBuilding.set(r.building_id, list)
  }

  const lastError =
    updateBuilding.error ??
    deleteBuilding.error ??
    createRoom.error ??
    updateRoom.error ??
    deleteRoom.error
  const pending =
    updateBuilding.isPending ||
    deleteBuilding.isPending ||
    createRoom.isPending ||
    updateRoom.isPending ||
    deleteRoom.isPending

  const toggleAddRoom = (buildingId: number) => {
    setOpenForm(v =>
      v?.kind === "addRoom" && v.buildingId === buildingId
        ? null
        : { kind: "addRoom", buildingId },
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
    b: { id: number; property_id: number; name: string; category: BuildingCategory },
    newName: string,
  ) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === b.name) {
      setEditingNameId(null)
      return
    }
    updateBuilding.mutate(
      {
        id: b.id,
        name: trimmed,
        property_id: b.property_id,
        category: b.category,
      },
      { onSuccess: () => { setEditingNameId(null) } },
    )
  }

  const handleDeleteBuilding = (buildingId: number, buildingName: string) => {
    if (!window.confirm(`Delete building "${buildingName}"?`)) return
    deleteBuilding.mutate(
      { id: buildingId },
      {
        onSuccess: () => {
          setOpenForm(null)
          setExpandedId(null)
        },
      },
    )
  }

  const handleAddRoom =
    (b: { id: number; property_id: number; name: string; category: BuildingCategory }) =>
    (data: RoomData) => {
      createRoom.mutate(
        { ...data, building_id: b.id },
        {
          onSuccess: () => {
            setOpenForm(null)
            if (b.category !== "habitable") {
              updateBuilding.mutate({
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
    (roomId: number, buildingId: number) => (data: RoomData) => {
      updateRoom.mutate(
        { id: roomId, building_id: buildingId, ...data },
        { onSuccess: () => { setOpenForm(null) } },
      )
    }

  const handleDeleteRoom = (
    room: { id: number; name: string },
    building: { id: number; property_id: number; name: string; category: BuildingCategory },
    isLastRoom: boolean,
  ) => {
    if (!window.confirm(`Delete room "${room.name}"?`)) return
    deleteRoom.mutate(
      { id: room.id },
      {
        onSuccess: () => {
          setOpenForm(null)
          if (isLastRoom && building.category !== "non_habitable") {
            updateBuilding.mutate({
              id: building.id,
              name: building.name,
              property_id: building.property_id,
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
        <h3>Buildings</h3>
        <p>No property selected. Pick one from the header.</p>
      </section>
    )
  }

  return (
    <section>
      <h3>Buildings for {selectedProperty.name}</h3>

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
          {propertyBuildings.map(b => {
            const buildingRooms = roomsByBuilding.get(b.id) ?? []
            const isExpanded = expandedId === b.id
            const isEditingName = editingNameId === b.id
            const addRoomOpen =
              openForm?.kind === "addRoom" && openForm.buildingId === b.id
            const editingRoom =
              openForm?.kind === "editRoom"
                ? buildingRooms.find(r => r.id === openForm.roomId) ?? null
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
                          aria-label="Building name"
                          disabled={updateBuilding.isPending}
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
                              editingRoom.building_id,
                            )}
                            onCancel={() => { setOpenForm(null) }}
                          />
                        ) : buildingRooms.length === 0 ? (
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
                            {buildingRooms.map(r => (
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
                                      buildingRooms.length === 1,
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
                          onClick={() => { handleDeleteBuilding(b.id, b.name) }}
                        >
                          Delete building
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
                        Edit building
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
                    <strong>Add building</strong>
                    <AddBuildingFlow
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
                    + Add building
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        </ul>
    </section>
  )
}
