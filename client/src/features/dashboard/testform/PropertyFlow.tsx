import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type RoomType = "single" | "double" | "family"

const ROOM_TYPES: RoomType[] = ["single", "double", "family"]

function roomBeds(r: {
  beds_sm: number
  beds_lg: number
  beds_double: number
  mattresses: number
  travel_cot: number
}) {
  return r.beds_sm + r.beds_lg + r.beds_double * 2 + r.mattresses + r.travel_cot
}

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  return typeof v === "string" ? Number(v) : 0
}

type PropertyFormSlot = { id: number | null } | null
type BuildingFormSlot = { propertyId: number; id: number | null } | null
type RoomFormSlot = { buildingId: number; id: number | null } | null

export function PropertyFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.building.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.room.list.queryKey() })
  }

  const createProperty = useMutation(
    trpc.property.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const updateProperty = useMutation(
    trpc.property.update.mutationOptions({ onSuccess: invalidateAll }),
  )
  const deleteProperty = useMutation(
    trpc.property.delete.mutationOptions({ onSuccess: invalidateAll }),
  )

  const createBuilding = useMutation(
    trpc.building.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const updateBuilding = useMutation(
    trpc.building.update.mutationOptions({ onSuccess: invalidateAll }),
  )
  const deleteBuilding = useMutation(
    trpc.building.delete.mutationOptions({ onSuccess: invalidateAll }),
  )

  const createRoom = useMutation(
    trpc.room.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const updateRoom = useMutation(
    trpc.room.update.mutationOptions({ onSuccess: invalidateAll }),
  )
  const deleteRoom = useMutation(
    trpc.room.delete.mutationOptions({ onSuccess: invalidateAll }),
  )

  const lastError =
    createProperty.error ??
    updateProperty.error ??
    deleteProperty.error ??
    createBuilding.error ??
    updateBuilding.error ??
    deleteBuilding.error ??
    createRoom.error ??
    updateRoom.error ??
    deleteRoom.error

  const propertyPending =
    createProperty.isPending ||
    updateProperty.isPending ||
    deleteProperty.isPending
  const buildingPending =
    createBuilding.isPending ||
    updateBuilding.isPending ||
    deleteBuilding.isPending
  const roomPending =
    createRoom.isPending || updateRoom.isPending || deleteRoom.isPending

  const [propertyForm, setPropertyForm] = useState<PropertyFormSlot>(null)
  const [buildingForm, setBuildingForm] = useState<BuildingFormSlot>(null)
  const [roomForm, setRoomForm] = useState<RoomFormSlot>(null)

  const closePropertyForm = () => {
    setPropertyForm(null)
  }
  const closeBuildingForm = () => {
    setBuildingForm(null)
  }
  const closeRoomForm = () => {
    setRoomForm(null)
  }

  const buildingsByProperty = new Map<number, typeof buildings>()
  for (const b of buildings) {
    const list = buildingsByProperty.get(b.property_id) ?? []
    list.push(b)
    buildingsByProperty.set(b.property_id, list)
  }

  const roomsByBuilding = new Map<number, typeof rooms>()
  for (const r of rooms) {
    const list = roomsByBuilding.get(r.building_id) ?? []
    list.push(r)
    roomsByBuilding.set(r.building_id, list)
  }

  const handlePropertySubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload = {
      name: fdString(fd, "name"),
      address: fdString(fd, "address"),
    }
    const id = propertyForm?.id ?? null
    const opts = {
      onSuccess: () => {
        form.reset()
        setPropertyForm(null)
      },
    }
    if (id == null) createProperty.mutate(payload, opts)
    else updateProperty.mutate({ id, ...payload }, opts)
  }

  const handleBuildingSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!buildingForm) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload = {
      name: fdString(fd, "name"),
      property_id: buildingForm.propertyId,
    }
    const id = buildingForm.id
    const opts = {
      onSuccess: () => {
        form.reset()
        setBuildingForm(null)
      },
    }
    if (id == null) createBuilding.mutate(payload, opts)
    else updateBuilding.mutate({ id, ...payload }, opts)
  }

  const handleRoomSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!roomForm) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const rawType = fdString(fd, "room_type")
    const room_type: RoomType = ROOM_TYPES.includes(rawType as RoomType)
      ? (rawType as RoomType)
      : "single"
    const payload = {
      name: fdString(fd, "name"),
      building_id: roomForm.buildingId,
      room_type,
      beds_sm: fdNumber(fd, "beds_sm"),
      beds_lg: fdNumber(fd, "beds_lg"),
      beds_double: fdNumber(fd, "beds_double"),
      mattresses: fdNumber(fd, "mattresses"),
      travel_cot: fdNumber(fd, "travel_cot"),
    }
    const id = roomForm.id
    const opts = {
      onSuccess: () => {
        form.reset()
        setRoomForm(null)
      },
    }
    if (id == null) createRoom.mutate(payload, opts)
    else updateRoom.mutate({ id, ...payload }, opts)
  }

  const handleDeleteProperty = (id: number) => {
    if (!window.confirm("Delete this property?")) return
    deleteProperty.mutate({ id })
  }
  const handleDeleteBuilding = (id: number) => {
    if (!window.confirm("Delete this building?")) return
    deleteBuilding.mutate({ id })
  }
  const handleDeleteRoom = (id: number) => {
    if (!window.confirm("Delete this room?")) return
    deleteRoom.mutate({ id })
  }

  const isCreatePropertyOpen = propertyForm?.id === null
  const editingPropertyId = propertyForm?.id ?? null

  const isCreateBuildingOpenFor = (pid: number) =>
    buildingForm?.propertyId === pid && buildingForm.id === null
  const editingBuildingId = buildingForm?.id ?? null

  const isCreateRoomOpenFor = (bid: number) =>
    roomForm?.buildingId === bid && roomForm.id === null
  const editingRoomId = roomForm?.id ?? null

  return (
    <section>
      <h3>Property Flow</h3>

      <div>
        <button
          type="button"
          onClick={() => {
            setPropertyForm(v => (v?.id === null ? null : { id: null }))
          }}
        >
          {isCreatePropertyOpen ? "Cancel" : "Add new property"}
        </button>
      </div>

      {isCreatePropertyOpen && (
        <NameAddressForm
          key="property-create"
          legend="New property"
          submitLabel="Create property"
          pending={propertyPending}
          onSubmit={handlePropertySubmit}
          onCancel={closePropertyForm}
        />
      )}

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {properties.length === 0 && <p>No properties yet.</p>}

      <ul>
        {properties.map(p => {
          const propBuildings = buildingsByProperty.get(p.id) ?? []
          const propRooms = propBuildings.flatMap(
            b => roomsByBuilding.get(b.id) ?? [],
          )
          const totalBeds = propRooms.reduce((s, r) => s + roomBeds(r), 0)
          const propertyIsEditing = editingPropertyId === p.id
          return (
            <li key={p.id}>
              <h4>
                {p.name} <small>({p.address})</small>
              </h4>
              <p>
                {propBuildings.length} building(s), {propRooms.length} room(s),{" "}
                {totalBeds} bed(s) total
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setPropertyForm(v =>
                      v?.id === p.id ? null : { id: p.id },
                    )
                  }}
                  disabled={propertyPending}
                >
                  {propertyIsEditing ? "Cancel edit" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteProperty(p.id)
                  }}
                  disabled={propertyPending}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBuildingForm(v =>
                      v?.propertyId === p.id && v.id === null
                        ? null
                        : { propertyId: p.id, id: null },
                    )
                  }}
                >
                  {isCreateBuildingOpenFor(p.id)
                    ? "Cancel"
                    : "Add building to property"}
                </button>
              </div>

              {propertyIsEditing && (
                <NameAddressForm
                  key={`property-edit-${String(p.id)}`}
                  legend={`Edit property #${String(p.id)}`}
                  submitLabel="Update property"
                  pending={propertyPending}
                  defaults={{ name: p.name, address: p.address }}
                  onSubmit={handlePropertySubmit}
                  onCancel={closePropertyForm}
                />
              )}

              {isCreateBuildingOpenFor(p.id) && (
                <NameOnlyForm
                  key={`building-create-${String(p.id)}`}
                  legend={`New building in ${p.name}`}
                  submitLabel="Create building"
                  pending={buildingPending}
                  onSubmit={handleBuildingSubmit}
                  onCancel={closeBuildingForm}
                />
              )}

              {propBuildings.length === 0 ? (
                <p>No buildings yet.</p>
              ) : (
                <ul>
                  {propBuildings.map(b => {
                    const buildingRooms = roomsByBuilding.get(b.id) ?? []
                    const buildingBeds = buildingRooms.reduce(
                      (s, r) => s + roomBeds(r),
                      0,
                    )
                    const buildingIsEditing = editingBuildingId === b.id
                    return (
                      <li key={b.id}>
                        <h5>{b.name}</h5>
                        <p>
                          {buildingRooms.length} room(s), {buildingBeds} bed(s)
                        </p>

                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setBuildingForm(v =>
                                v?.id === b.id
                                  ? null
                                  : { propertyId: b.property_id, id: b.id },
                              )
                            }}
                            disabled={buildingPending}
                          >
                            {buildingIsEditing ? "Cancel edit" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteBuilding(b.id)
                            }}
                            disabled={buildingPending}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRoomForm(v =>
                                v?.buildingId === b.id && v.id === null
                                  ? null
                                  : { buildingId: b.id, id: null },
                              )
                            }}
                          >
                            {isCreateRoomOpenFor(b.id) ? "Cancel" : "Add room"}
                          </button>
                        </div>

                        {buildingIsEditing && (
                          <NameOnlyForm
                            key={`building-edit-${String(b.id)}`}
                            legend={`Edit building #${String(b.id)}`}
                            submitLabel="Update building"
                            pending={buildingPending}
                            defaults={{ name: b.name }}
                            onSubmit={handleBuildingSubmit}
                            onCancel={closeBuildingForm}
                          />
                        )}

                        {isCreateRoomOpenFor(b.id) && (
                          <RoomFormBlock
                            key={`room-create-${String(b.id)}`}
                            legend={`New room in ${b.name}`}
                            submitLabel="Create room"
                            pending={roomPending}
                            onSubmit={handleRoomSubmit}
                            onCancel={closeRoomForm}
                          />
                        )}

                        {buildingRooms.length > 0 && (
                          <ul>
                            {buildingRooms.map(r => {
                              const roomIsEditing = editingRoomId === r.id
                              return (
                                <li key={r.id}>
                                  {r.name} – {r.room_type} – {roomBeds(r)}{" "}
                                  bed(s)
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRoomForm(v =>
                                          v?.id === r.id
                                            ? null
                                            : {
                                                buildingId: r.building_id,
                                                id: r.id,
                                              },
                                        )
                                      }}
                                      disabled={roomPending}
                                    >
                                      {roomIsEditing ? "Cancel edit" : "Edit"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteRoom(r.id)
                                      }}
                                      disabled={roomPending}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                  {roomIsEditing && (
                                    <RoomFormBlock
                                      key={`room-edit-${String(r.id)}`}
                                      legend={`Edit room #${String(r.id)}`}
                                      submitLabel="Update room"
                                      pending={roomPending}
                                      defaults={{
                                        name: r.name,
                                        room_type: r.room_type,
                                        beds_sm: r.beds_sm,
                                        beds_lg: r.beds_lg,
                                        beds_double: r.beds_double,
                                        mattresses: r.mattresses,
                                        travel_cot: r.travel_cot,
                                      }}
                                      onSubmit={handleRoomSubmit}
                                      onCancel={closeRoomForm}
                                    />
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type NameOnlyDefaults = { name: string }

function NameOnlyForm({
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
  defaults?: NameOnlyDefaults
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

type NameAddressDefaults = { name: string; address: string }

function NameAddressForm({
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
  defaults?: NameAddressDefaults
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
            Address
            <input
              type="text"
              name="address"
              defaultValue={defaults?.address ?? ""}
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

type RoomDefaults = {
  name: string
  room_type: RoomType
  beds_sm: number
  beds_lg: number
  beds_double: number
  mattresses: number
  travel_cot: number
}

function RoomFormBlock({
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
            Room type
            <select
              name="room_type"
              defaultValue={defaults?.room_type ?? "single"}
            >
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