import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

function roomBeds(r: {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}) {
  return (
    r.beds_sm +
    r.beds_lg +
    r.beds_double * 2 +
    r.beds_kid +
    r.mattresses +
    r.travel_cot
  )
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
type StructureFormSlot = { propertyId: number; id: number | null } | null
type RoomFormSlot = { structureId: number; id: number | null } | null

export function PropertyFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: structures } = useSuspenseQuery(
    trpc.structure.list.queryOptions(),
  )
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.structure.list.queryKey() })
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

  const createStructure = useMutation(
    trpc.structure.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const updateStructure = useMutation(
    trpc.structure.update.mutationOptions({ onSuccess: invalidateAll }),
  )
  const deleteStructure = useMutation(
    trpc.structure.delete.mutationOptions({ onSuccess: invalidateAll }),
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
    createStructure.error ??
    updateStructure.error ??
    deleteStructure.error ??
    createRoom.error ??
    updateRoom.error ??
    deleteRoom.error

  const propertyPending =
    createProperty.isPending ||
    updateProperty.isPending ||
    deleteProperty.isPending
  const structurePending =
    createStructure.isPending ||
    updateStructure.isPending ||
    deleteStructure.isPending
  const roomPending =
    createRoom.isPending || updateRoom.isPending || deleteRoom.isPending

  const [propertyForm, setPropertyForm] = useState<PropertyFormSlot>(null)
  const [structureForm, setStructureForm] = useState<StructureFormSlot>(null)
  const [roomForm, setRoomForm] = useState<RoomFormSlot>(null)

  const closePropertyForm = () => {
    setPropertyForm(null)
  }
  const closeStructureForm = () => {
    setStructureForm(null)
  }
  const closeRoomForm = () => {
    setRoomForm(null)
  }

  const structuresByProperty = new Map<number, typeof structures>()
  for (const b of structures) {
    const list = structuresByProperty.get(b.property_id) ?? []
    list.push(b)
    structuresByProperty.set(b.property_id, list)
  }

  const roomsByStructure = new Map<number, typeof rooms>()
  for (const r of rooms) {
    const list = roomsByStructure.get(r.structure_id) ?? []
    list.push(r)
    roomsByStructure.set(r.structure_id, list)
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

  const handleStructureSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!structureForm) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload = {
      name: fdString(fd, "name"),
      property_id: structureForm.propertyId,
    }
    const id = structureForm.id
    const opts = {
      onSuccess: () => {
        form.reset()
        setStructureForm(null)
      },
    }
    if (id == null) createStructure.mutate(payload, opts)
    else updateStructure.mutate({ id, ...payload }, opts)
  }

  const handleRoomSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!roomForm) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload = {
      name: fdString(fd, "name"),
      structure_id: roomForm.structureId,
      beds_sm: fdNumber(fd, "beds_sm"),
      beds_lg: fdNumber(fd, "beds_lg"),
      beds_double: fdNumber(fd, "beds_double"),
      beds_kid: fdNumber(fd, "beds_kid"),
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
  const handleDeleteStructure = (id: number) => {
    if (!window.confirm("Delete this structure?")) return
    deleteStructure.mutate({ id })
  }
  const handleDeleteRoom = (id: number) => {
    if (!window.confirm("Delete this room?")) return
    deleteRoom.mutate({ id })
  }

  const isCreatePropertyOpen = propertyForm?.id === null
  const editingPropertyId = propertyForm?.id ?? null

  const isCreateStructureOpenFor = (pid: number) =>
    structureForm?.propertyId === pid && structureForm.id === null
  const editingStructureId = structureForm?.id ?? null

  const isCreateRoomOpenFor = (bid: number) =>
    roomForm?.structureId === bid && roomForm.id === null
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
          const propStructures = structuresByProperty.get(p.id) ?? []
          const propRooms = propStructures.flatMap(
            b => roomsByStructure.get(b.id) ?? [],
          )
          const totalBeds = propRooms.reduce((s, r) => s + roomBeds(r), 0)
          const propertyIsEditing = editingPropertyId === p.id
          return (
            <li key={p.id}>
              <h4>
                {p.name} <small>({p.address})</small>
              </h4>
              <p>
                {propStructures.length} structure(s), {propRooms.length} room(s),{" "}
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
                    setStructureForm(v =>
                      v?.propertyId === p.id && v.id === null
                        ? null
                        : { propertyId: p.id, id: null },
                    )
                  }}
                >
                  {isCreateStructureOpenFor(p.id)
                    ? "Cancel"
                    : "Add structure to property"}
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

              {isCreateStructureOpenFor(p.id) && (
                <NameOnlyForm
                  key={`structure-create-${String(p.id)}`}
                  legend={`New structure in ${p.name}`}
                  submitLabel="Create structure"
                  pending={structurePending}
                  onSubmit={handleStructureSubmit}
                  onCancel={closeStructureForm}
                />
              )}

              {propStructures.length === 0 ? (
                <p>No Structures yet.</p>
              ) : (
                <ul>
                  {propStructures.map(b => {
                    const structureRooms = roomsByStructure.get(b.id) ?? []
                    const buildingBeds = structureRooms.reduce(
                      (s, r) => s + roomBeds(r),
                      0,
                    )
                    const buildingIsEditing = editingStructureId === b.id
                    return (
                      <li key={b.id}>
                        <h5>{b.name}</h5>
                        <p>
                          {structureRooms.length} room(s), {buildingBeds} bed(s)
                        </p>

                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setStructureForm(v =>
                                v?.id === b.id
                                  ? null
                                  : { propertyId: b.property_id, id: b.id },
                              )
                            }}
                            disabled={structurePending}
                          >
                            {buildingIsEditing ? "Cancel edit" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteStructure(b.id)
                            }}
                            disabled={structurePending}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRoomForm(v =>
                                v?.structureId === b.id && v.id === null
                                  ? null
                                  : { structureId: b.id, id: null },
                              )
                            }}
                          >
                            {isCreateRoomOpenFor(b.id) ? "Cancel" : "Add room"}
                          </button>
                        </div>

                        {buildingIsEditing && (
                          <NameOnlyForm
                            key={`structure-edit-${String(b.id)}`}
                            legend={`Edit structure #${String(b.id)}`}
                            submitLabel="Update structure"
                            pending={structurePending}
                            defaults={{ name: b.name }}
                            onSubmit={handleStructureSubmit}
                            onCancel={closeStructureForm}
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

                        {structureRooms.length > 0 && (
                          <ul>
                            {structureRooms.map(r => {
                              const roomIsEditing = editingRoomId === r.id
                              return (
                                <li key={r.id}>
                                  {r.name} – {roomBeds(r)}{" "}
                                  bed(s)
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRoomForm(v =>
                                          v?.id === r.id
                                            ? null
                                            : {
                                                structureId: r.structure_id,
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
                                        beds_sm: r.beds_sm,
                                        beds_lg: r.beds_lg,
                                        beds_double: r.beds_double,
                                        beds_kid: r.beds_kid,
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
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
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