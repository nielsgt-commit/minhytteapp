import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc.ts"

type RoomType = "single" | "double" | "family"

const ROOM_TYPES: RoomType[] = ["single", "double", "family"]

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

export function AddBuildingFlow() {
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

  const createBuilding = useMutation(
    trpc.building.create.mutationOptions({ onSuccess: invalidateBuildings }),
  )
  const createRoom = useMutation(
    trpc.room.create.mutationOptions({ onSuccess: invalidateRooms }),
  )

  const [addRoomForBuildingId, setAddRoomForBuildingId] = useState<
    number | null
  >(null)

  const lastError = createBuilding.error ?? createRoom.error
  const pending = createBuilding.isPending || createRoom.isPending

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

  const handleAddRoom = (buildingId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const name = fdString(fd, "name").trim()
      const room_type = fdString(fd, "room_type") as RoomType
      if (!name || !ROOM_TYPES.includes(room_type)) return
      createRoom.mutate(
        {
          name,
          building_id: buildingId,
          room_type,
          beds_sm: fdNumber(fd, "beds_sm"),
          beds_lg: fdNumber(fd, "beds_lg"),
          beds_double: fdNumber(fd, "beds_double"),
          mattresses: fdNumber(fd, "mattresses"),
          travel_cot: fdNumber(fd, "travel_cot"),
        },
        {
          onSuccess: () => {
            form.reset()
            setAddRoomForBuildingId(null)
          },
        },
      )
    }

  return (
    <section>
      <h3>Add Building Flow</h3>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

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
                <button type="submit" disabled={pending}>
                  Add building
                </button>
              </div>
            </fieldset>
          </form>

          <h4>Buildings for {selectedProperty.name}</h4>
          {propertyBuildings.length === 0 ? (
            <p>No buildings yet.</p>
          ) : (
            <ul>
              {propertyBuildings.map(b => {
                const buildingRooms = roomsByBuilding.get(b.id) ?? []
                const addOpen = addRoomForBuildingId === b.id
                return (
                  <li key={b.id}>
                    <h5>{b.name}</h5>
                    {buildingRooms.length === 0 ? (
                      <p>No rooms yet.</p>
                    ) : (
                      <ul>
                        {buildingRooms.map(r => (
                          <li key={r.id}>
                            {r.name} – {r.room_type} (sm:{r.beds_sm}, lg:
                            {r.beds_lg}, dbl:{r.beds_double}, mat:
                            {r.mattresses}, cot:{r.travel_cot})
                          </li>
                        ))}
                      </ul>
                    )}

                    <div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setAddRoomForBuildingId(v =>
                            v === b.id ? null : b.id,
                          )
                        }}
                      >
                        {addOpen ? "Cancel" : "Add room"}
                      </button>
                    </div>

                    {addOpen && (
                      <AddRoomForm
                        key={`add-room-${String(b.id)}`}
                        buildingName={b.name}
                        pending={createRoom.isPending}
                        onSubmit={handleAddRoom(b.id)}
                        onCancel={() => { setAddRoomForBuildingId(null) }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function AddRoomForm({
  buildingName,
  pending,
  onSubmit,
  onCancel,
}: {
  buildingName: string
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>Add room to {buildingName}</legend>
        <div>
          <label>
            Name
            <input type="text" name="name" required />
          </label>
        </div>
        <div>
          <label>
            Room type
            <select name="room_type" defaultValue="single" required>
              {ROOM_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Beds (single)
            <input type="number" name="beds_sm" min={0} defaultValue={0} required />
          </label>
        </div>
        <div>
          <label>
            Beds (large)
            <input type="number" name="beds_lg" min={0} defaultValue={0} required />
          </label>
        </div>
        <div>
          <label>
            Beds (double)
            <input type="number" name="beds_double" min={0} defaultValue={0} required />
          </label>
        </div>
        <div>
          <label>
            Mattresses
            <input type="number" name="mattresses" min={0} defaultValue={0} required />
          </label>
        </div>
        <div>
          <label>
            Travel cot
            <input type="number" name="travel_cot" min={0} defaultValue={0} required />
          </label>
        </div>
        <div>
          <button type="submit" disabled={pending}>
            Save room
          </button>
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}