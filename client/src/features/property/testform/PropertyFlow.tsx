import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdString } from "@/utils/formData"
import { PropertyFormSection } from "./PropertyFormSection.tsx"
import { StructureFormSection } from "./StructureFormSection.tsx"
import { RoomFormSection } from "./RoomFormSection.tsx"

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

// Local fdNumber variant: returns 0 (not NaN) for invalid input so empty bed
// fields fall back to 0 rather than failing server-side validation.
function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  return typeof v === "string" ? Number(v) : 0
}

type PropertyFormSlot = { id: number | null } | null
type StructureFormSlot = { propertyId: number; id: number | null } | null
type RoomFormSlot = { structureId: number; id: number | null } | null

export function PropertyFlow() {
  const { t } = useTranslation("property")
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

  const createBuilding = useMutation(
    trpc.structure.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const updateBuilding = useMutation(
    trpc.structure.update.mutationOptions({ onSuccess: invalidateAll }),
  )
  const deleteBuilding = useMutation(
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
  const structurePending =
    createBuilding.isPending ||
    updateBuilding.isPending ||
    deleteBuilding.isPending
  const roomPending =
    createRoom.isPending || updateRoom.isPending || deleteRoom.isPending

  const [propertyForm, setPropertyForm] = useState<PropertyFormSlot>(null)
  const [structureForm, setStructureForm] = useState<StructureFormSlot>(null)
  const [roomForm, setRoomForm] = useState<RoomFormSlot>(null)

  const closePropertyForm = () => {
    setPropertyForm(null)
  }
  const closeBuildingForm = () => {
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

  const roomsByBuilding = new Map<number, typeof rooms>()
  for (const r of rooms) {
    const list = roomsByBuilding.get(r.structure_id) ?? []
    list.push(r)
    roomsByBuilding.set(r.structure_id, list)
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
    if (id == null) createBuilding.mutate(payload, opts)
    else updateBuilding.mutate({ id, ...payload }, opts)
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
    if (!window.confirm(t("Delete this property?"))) return
    deleteProperty.mutate({ id })
  }
  const handleDeleteBuilding = (id: number) => {
    if (!window.confirm(t("Delete this structure?"))) return
    deleteBuilding.mutate({ id })
  }
  const handleDeleteRoom = (id: number) => {
    if (!window.confirm(t("Delete this room?"))) return
    deleteRoom.mutate({ id })
  }

  const isCreatePropertyOpen = propertyForm?.id === null
  const editingPropertyId = propertyForm?.id ?? null

  const isCreateBuildingOpenFor = (pid: number) =>
    structureForm?.propertyId === pid && structureForm.id === null
  const editingBuildingId = structureForm?.id ?? null

  const isCreateRoomOpenFor = (bid: number) =>
    roomForm?.structureId === bid && roomForm.id === null
  const editingRoomId = roomForm?.id ?? null

  return (
    <section>
      <h3>{t("Property Flow")}</h3>

      <div>
        <button
          type="button"
          onClick={() => {
            setPropertyForm(v => (v?.id === null ? null : { id: null }))
          }}
        >
          {isCreatePropertyOpen ? t("Cancel") : t("Add new property")}
        </button>
      </div>

      {isCreatePropertyOpen && (
        <PropertyFormSection
          key="property-create"
          legend={t("New property")}
          submitLabel={t("Create property")}
          pending={propertyPending}
          onSubmit={handlePropertySubmit}
          onCancel={closePropertyForm}
        />
      )}

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      {properties.length === 0 && <p>{t("No properties yet.")}</p>}

      <ul>
        {properties.map(p => {
          const propStructures = structuresByProperty.get(p.id) ?? []
          const propRooms = propStructures.flatMap(
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
                {t("{{structures}} structure(s), {{rooms}} room(s), {{beds}} bed(s) total", {
                  structures: propStructures.length,
                  rooms: propRooms.length,
                  beds: totalBeds,
                })}
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
                  {propertyIsEditing ? t("Cancel edit") : t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteProperty(p.id)
                  }}
                  disabled={propertyPending}
                >
                  {t("Delete")}
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
                  {isCreateBuildingOpenFor(p.id)
                    ? t("Cancel")
                    : t("Add structure to property")}
                </button>
              </div>

              {propertyIsEditing && (
                <PropertyFormSection
                  key={`property-edit-${String(p.id)}`}
                  legend={t("Edit property #{{id}}", { id: p.id })}
                  submitLabel={t("Update property")}
                  pending={propertyPending}
                  defaults={{ name: p.name, address: p.address }}
                  onSubmit={handlePropertySubmit}
                  onCancel={closePropertyForm}
                />
              )}

              {isCreateBuildingOpenFor(p.id) && (
                <StructureFormSection
                  key={`structure-create-${String(p.id)}`}
                  legend={t("New structure in {{name}}", { name: p.name })}
                  submitLabel={t("Create structure")}
                  pending={structurePending}
                  onSubmit={handleBuildingSubmit}
                  onCancel={closeBuildingForm}
                />
              )}

              {propStructures.length === 0 ? (
                <p>{t("No structures yet.")}</p>
              ) : (
                <ul>
                  {propStructures.map(b => {
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
                          {t("{{rooms}} room(s), {{beds}} bed(s)", {
                            rooms: buildingRooms.length,
                            beds: buildingBeds,
                          })}
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
                            {buildingIsEditing ? t("Cancel edit") : t("Edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteBuilding(b.id)
                            }}
                            disabled={structurePending}
                          >
                            {t("Delete")}
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
                            {isCreateRoomOpenFor(b.id) ? t("Cancel") : t("Add room")}
                          </button>
                        </div>

                        {buildingIsEditing && (
                          <StructureFormSection
                            key={`structure-edit-${String(b.id)}`}
                            legend={t("Edit structure #{{id}}", { id: b.id })}
                            submitLabel={t("Update structure")}
                            pending={structurePending}
                            defaults={{ name: b.name }}
                            onSubmit={handleBuildingSubmit}
                            onCancel={closeBuildingForm}
                          />
                        )}

                        {isCreateRoomOpenFor(b.id) && (
                          <RoomFormSection
                            key={`room-create-${String(b.id)}`}
                            legend={t("New room in {{name}}", { name: b.name })}
                            submitLabel={t("Create room")}
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
                                  {t("{{name}} – {{beds}} bed(s)", { name: r.name, beds: roomBeds(r) })}
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
                                      {roomIsEditing ? t("Cancel edit") : t("Edit")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteRoom(r.id)
                                      }}
                                      disabled={roomPending}
                                    >
                                      {t("Delete")}
                                    </button>
                                  </div>
                                  {roomIsEditing && (
                                    <RoomFormSection
                                      key={`room-edit-${String(r.id)}`}
                                      legend={t("Edit room #{{id}}", { id: r.id })}
                                      submitLabel={t("Update room")}
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
