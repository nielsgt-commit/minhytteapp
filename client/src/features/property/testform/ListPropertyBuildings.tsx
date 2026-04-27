import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type OpenForm =
  | { kind: "editBuilding"; buildingId: number }
  | { kind: "addRoom"; buildingId: number }
  | { kind: "editRoom"; roomId: number }
  | null

type RoomDefaults = {
  name: string
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  if (typeof v !== "string" || v === "") return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

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

  const toggleBuildingForm = (
    kind: "editBuilding" | "addRoom",
    buildingId: number,
  ) => {
    setOpenForm(v =>
      v?.kind === kind && v.buildingId === buildingId
        ? null
        : { kind, buildingId },
    )
  }

  const toggleRoomEdit = (roomId: number) => {
    setOpenForm(v =>
      v?.kind === "editRoom" && v.roomId === roomId
        ? null
        : { kind: "editRoom", roomId },
    )
  }

  const handleEditBuilding = (buildingId: number, propertyId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const name = fdString(fd, "name").trim()
      if (!name) return
      updateBuilding.mutate(
        { id: buildingId, name, property_id: propertyId },
        { onSuccess: () => { setOpenForm(null) } },
      )
    }

  const handleDeleteBuilding = (buildingId: number, buildingName: string) => {
    if (!window.confirm(`Delete building "${buildingName}"?`)) return
    deleteBuilding.mutate(
      { id: buildingId },
      { onSuccess: () => { setOpenForm(null) } },
    )
  }

  const handleAddRoom = (buildingId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const name = fdString(fd, "name").trim()
      if (!name) return
      createRoom.mutate(
        {
          name,
          building_id: buildingId,
          beds_sm: fdNumber(fd, "beds_sm"),
          beds_lg: fdNumber(fd, "beds_lg"),
          beds_double: fdNumber(fd, "beds_double"),
          beds_kid: fdNumber(fd, "beds_kid"),
          mattresses: fdNumber(fd, "mattresses"),
          travel_cot: fdNumber(fd, "travel_cot"),
        },
        {
          onSuccess: () => {
            form.reset()
            setOpenForm(null)
          },
        },
      )
    }

  const handleEditRoom = (roomId: number, buildingId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const name = fdString(fd, "name").trim()
      if (!name) return
      updateRoom.mutate(
        {
          id: roomId,
          name,
          building_id: buildingId,
          beds_sm: fdNumber(fd, "beds_sm"),
          beds_lg: fdNumber(fd, "beds_lg"),
          beds_double: fdNumber(fd, "beds_double"),
          beds_kid: fdNumber(fd, "beds_kid"),
          mattresses: fdNumber(fd, "mattresses"),
          travel_cot: fdNumber(fd, "travel_cot"),
        },
        { onSuccess: () => { setOpenForm(null) } },
      )
    }

  const handleDeleteRoom = (roomId: number, roomName: string) => {
    if (!window.confirm(`Delete room "${roomName}"?`)) return
    deleteRoom.mutate(
      { id: roomId },
      { onSuccess: () => { setOpenForm(null) } },
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

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {propertyBuildings.length === 0 ? (
        <p>No buildings yet.</p>
      ) : (
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
            const editBuildingOpen =
              openForm?.kind === "editBuilding" &&
              openForm.buildingId === b.id
            const addRoomOpen =
              openForm?.kind === "addRoom" && openForm.buildingId === b.id
            return (
              <li key={b.id} style={{ flex: "1 1 240px", minWidth: 0 }}>
                <h4>{b.name}</h4>
                {buildingRooms.length === 0 ? (
                  <p>No rooms yet.</p>
                ) : (
                  <ul>
                    {buildingRooms.map(r => {
                      const editRoomOpen =
                        openForm?.kind === "editRoom" &&
                        openForm.roomId === r.id
                      return (
                        <li key={r.id}>
                          {r.name} (sm:{r.beds_sm}, lg:{r.beds_lg}, dbl:
                          {r.beds_double}, kid:{r.beds_kid}, mat:
                          {r.mattresses}, cot:{r.travel_cot})
                          <div>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => { toggleRoomEdit(r.id); }}
                            >
                              {editRoomOpen ? "Cancel" : "Edit"}
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => { handleDeleteRoom(r.id, r.name); }}
                            >
                              Delete
                            </button>
                          </div>
                          {editRoomOpen && (
                            <RoomForm
                              key={`edit-room-${String(r.id)}`}
                              legend={`Edit room ${r.name}`}
                              submitLabel="Save room"
                              pending={updateRoom.isPending}
                              defaults={{
                                name: r.name,
                                beds_sm: r.beds_sm,
                                beds_lg: r.beds_lg,
                                beds_double: r.beds_double,
                                beds_kid: r.beds_kid,
                                mattresses: r.mattresses,
                                travel_cot: r.travel_cot,
                              }}
                              onSubmit={handleEditRoom(r.id, r.building_id)}
                              onCancel={() => { setOpenForm(null) }}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { toggleBuildingForm("editBuilding", b.id); }}
                  >
                    {editBuildingOpen ? "Cancel" : "Edit"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { toggleBuildingForm("addRoom", b.id); }}
                  >
                    {addRoomOpen ? "Cancel" : "Add room"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { handleDeleteBuilding(b.id, b.name); }}
                  >
                    Delete
                  </button>
                </div>

                {editBuildingOpen && (
                  <EditBuildingForm
                    key={`edit-building-${String(b.id)}`}
                    defaultName={b.name}
                    pending={updateBuilding.isPending}
                    onSubmit={handleEditBuilding(b.id, b.property_id)}
                    onCancel={() => { setOpenForm(null) }}
                  />
                )}

                {addRoomOpen && (
                  <RoomForm
                    key={`add-room-${String(b.id)}`}
                    legend={`Add room to ${b.name}`}
                    submitLabel="Save room"
                    pending={createRoom.isPending}
                    onSubmit={handleAddRoom(b.id)}
                    onCancel={() => { setOpenForm(null) }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function EditBuildingForm({
  defaultName,
  pending,
  onSubmit,
  onCancel,
}: {
  defaultName: string
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>Edit building</legend>
        <div>
          <label>
            Name
            <input type="text" name="name" defaultValue={defaultName} required />
          </label>
        </div>
        <div>
          <button type="submit" disabled={pending}>
            Save
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}

function RoomForm({
  legend,
  submitLabel,
  pending,
  defaults,
  onSubmit,
  onCancel,
}: {
  legend: string
  submitLabel: string
  pending: boolean
  defaults?: RoomDefaults
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>{legend}</legend>
        <div>
          <label>
            Name
            <input
              type="text"
              name="name"
              defaultValue={defaults?.name ?? ""}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Beds (single)
            <input
              type="number"
              name="beds_sm"
              min={0}
              defaultValue={defaults?.beds_sm ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Beds (large)
            <input
              type="number"
              name="beds_lg"
              min={0}
              defaultValue={defaults?.beds_lg ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Beds (double)
            <input
              type="number"
              name="beds_double"
              min={0}
              defaultValue={defaults?.beds_double ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Beds (kid)
            <input
              type="number"
              name="beds_kid"
              min={0}
              defaultValue={defaults?.beds_kid ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Mattresses
            <input
              type="number"
              name="mattresses"
              min={0}
              defaultValue={defaults?.mattresses ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Travel cot
            <input
              type="number"
              name="travel_cot"
              min={0}
              defaultValue={defaults?.travel_cot ?? 0}
              required
            />
          </label>
        </div>
        <div>
          <button type="submit" disabled={pending}>
            {submitLabel}
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}