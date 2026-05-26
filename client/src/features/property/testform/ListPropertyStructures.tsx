import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Card, Divider } from "@digdir/designsystemet-react"
import { BedIcon, WrenchIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useCanEdit } from "@/hooks/useCanEdit"
import { InlineEditField } from "@/components/shared/InlineEditField"
import { AddStructureFlow } from "@/features/property/testform/AddStructureFlow.tsx"
import {
  AddBedsFlow,
  type RoomData,
} from "@/features/property/testform/AddBedsFlow.tsx"
import styles from "./ListPropertyStructures.module.css"

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
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const canEdit = useCanEdit()

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
  const [expandedId, setExpandedId] = useState<number | null>(null)
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
    b: {
      id: number
      property_id: number
      name: string
      category: StructureCategory
    },
    newName: string,
  ) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === b.name) return
    updateStructure.mutate({
      id: b.id,
      name: trimmed,
      property_id: b.property_id,
      category: b.category,
    })
  }

  const handleDeleteStructure = (
    structureId: number,
    structureName: string,
  ) => {
    if (
      !window.confirm(
        t('Delete structure "{{name}}"?', { name: structureName }),
      )
    )
      return
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
    (b: {
      id: number
      property_id: number
      name: string
      category: StructureCategory
    }) =>
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
        {
          onSuccess: () => {
            setOpenForm(null)
          },
        },
      )
    }

  const handleDeleteRoom = (
    room: { id: number; name: string },
    structure: {
      id: number
      property_id: number
      name: string
      category: StructureCategory
    },
    isLastRoom: boolean,
  ) => {
    if (!window.confirm(t('Delete room "{{name}}"?', { name: room.name })))
      return
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
        <h3>{t("Structures")}</h3>
        <p>{t("No property selected. Pick one from the header.")}</p>
      </section>
    )
  }

  return (
    <section>
      <h3>{t("Structures for {{name}}", { name: selectedProperty.name })}</h3>

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      <ul className={styles.list}>
        {propertyStructures.map(b => {
          const structureRooms = roomsByStructure.get(b.id) ?? []
          const isExpanded = expandedId === b.id
          const addRoomOpen =
            openForm?.kind === "addRoom" && openForm.structureId === b.id
          const editingRoom =
            openForm?.kind === "editRoom"
              ? (structureRooms.find(r => r.id === openForm.roomId) ?? null)
              : null

          return (
            <Card asChild key={b.id}>
              <li className={styles.cardItem}>
                <Card.Block className={styles.cardBlock}>
                  <div className={styles.header}>
                    <InlineEditField
                      value={b.name}
                      canEdit={canEdit}
                      pending={updateStructure.isPending}
                      ariaLabel={t("Edit structure {{name}}", { name: b.name })}
                      onSave={next => {
                        handleNameSave(b, next)
                      }}
                    />
                    {structureRooms.length > 0 ? (
                      <BedIcon
                        aria-label={(t as (k: string) => string)(
                          CATEGORY_LABEL[b.category],
                        )}
                        title={(t as (k: string) => string)(
                          CATEGORY_LABEL[b.category],
                        )}
                        fontSize="1.25rem"
                      />
                    ) : (
                      <WrenchIcon
                        aria-label={(t as (k: string) => string)(
                          CATEGORY_LABEL[b.category],
                        )}
                        title={(t as (k: string) => string)(
                          CATEGORY_LABEL[b.category],
                        )}
                        fontSize="1.25rem"
                      />
                    )}
                    {b.built_year != null && (
                      <small title={t("Built year")}>
                        {t("Built {{year}}", { year: b.built_year })}
                      </small>
                    )}
                  </div>

                  {isExpanded && (
                    <>
                      <Divider />

                      {editingRoom ? (
                        <AddBedsFlow
                          key={`edit-room-${String(editingRoom.id)}`}
                          legend={t("Edit room {{name}}", {
                            name: editingRoom.name,
                          })}
                          submitLabel={t("Save room")}
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
                          onCancel={() => {
                            setOpenForm(null)
                          }}
                        />
                      ) : structureRooms.length === 0 ? (
                        <p>{t("No rooms yet.")}</p>
                      ) : (
                        <ul className={styles.roomList}>
                          {structureRooms.map(r => (
                            <li key={r.id} className={styles.roomRow}>
                              <span className={styles.roomName}>{r.name}</span>
                              <Button
                                variant="tertiary"
                                data-size="sm"
                                disabled={pending}
                                onClick={() => {
                                  toggleRoomEdit(r.id)
                                }}
                              >
                                {t("Edit")}
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
                                {t("Delete")}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          toggleAddRoom(b.id)
                        }}
                      >
                        {addRoomOpen ? t("Cancel") : t("Add room")}
                      </Button>

                      {addRoomOpen && (
                        <AddBedsFlow
                          key={`add-room-${String(b.id)}`}
                          legend={t("Add room to {{name}}", { name: b.name })}
                          submitLabel={t("Save room")}
                          pending={createRoom.isPending}
                          onSubmit={handleAddRoom(b)}
                          onCancel={() => {
                            setOpenForm(null)
                          }}
                        />
                      )}

                      <Button
                        variant="secondary"
                        data-color="danger"
                        disabled={pending}
                        onClick={() => {
                          handleDeleteStructure(b.id, b.name)
                        }}
                      >
                        {t("Delete structure")}
                      </Button>

                      <Button
                        variant="tertiary"
                        className={styles.closeButton}
                        onClick={() => {
                          setExpandedId(null)
                          setOpenForm(null)
                        }}
                      >
                        {t("Close")}
                      </Button>
                    </>
                  )}

                  {canEdit && !isExpanded && (
                    <Button
                      variant="secondary"
                      className={styles.closeButton}
                      disabled={pending}
                      onClick={() => {
                        setExpandedId(b.id)
                      }}
                    >
                      {t("Edit structure")}
                    </Button>
                  )}
                </Card.Block>
              </li>
            </Card>
          )
        })}

        {canEdit && (
          <Card asChild key="__add">
            <li className={styles.cardItem}>
              <Card.Block className={styles.cardBlock}>
                {isAdding ? (
                  <>
                    <strong>{t("Add structure")}</strong>
                    <AddStructureFlow
                      onAdded={() => {
                        setIsAdding(false)
                      }}
                      onCancel={() => {
                        setIsAdding(false)
                      }}
                    />
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    className={styles.addButton}
                    onClick={() => {
                      setIsAdding(true)
                    }}
                  >
                    {t("+ Add structure")}
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        )}
      </ul>
    </section>
  )
}
