import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card, Divider, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import {
  AddBedsFlow,
  type RoomData,
} from "@/features/property/structures/AddBedsFlow"
import listStyles from "./StepList.module.css"

type Props = {
  propertyId: number
}

type Room = {
  id: number
  name: string
  structure_id: number
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

export function BedroomsStep({ propertyId }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const canEdit = useCanEdit()

  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const roomKeys = [
    trpc.room.listForProperty.queryKey({ property_id: propertyId }),
  ]
  const createRoom = useMutationWithInvalidation(
    trpc.room.create.mutationOptions(),
    roomKeys,
  )
  const updateRoom = useMutationWithInvalidation(
    trpc.room.update.mutationOptions(),
    roomKeys,
  )
  const deleteRoom = useMutationWithInvalidation(
    trpc.room.delete.mutationOptions(),
    roomKeys,
  )

  const [addingForStructureId, setAddingForStructureId] = useState<
    number | null
  >(null)
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null)

  const lastError = createRoom.error ?? updateRoom.error ?? deleteRoom.error
  const pending =
    createRoom.isPending || updateRoom.isPending || deleteRoom.isPending

  const handleDeleteRoom = (r: Room) => {
    if (!window.confirm(t('Delete room "{{name}}"?', { name: r.name }))) return
    deleteRoom.mutate(
      { id: r.id },
      {
        onSuccess: () => {
          setEditingRoomId(null)
        },
      },
    )
  }

  const renderRoomEditForm = (r: Room) => (
    <AddBedsFlow
      legend={t("Edit {{name}}", { name: r.name })}
      submitLabel={t("Save")}
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
      onSubmit={(data: RoomData) => {
        updateRoom.mutate(
          { ...data, id: r.id, structure_id: r.structure_id },
          {
            onSuccess: () => {
              setEditingRoomId(null)
            },
          },
        )
      }}
      onCancel={() => {
        setEditingRoomId(null)
      }}
    />
  )

  if (structures.length === 0) {
    return (
      <section>
        <Heading level={3}>{t("Bedrooms")}</Heading>
        <p>{t("No buildings yet — skip ahead, you can add rooms later.")}</p>
      </section>
    )
  }

  return (
    <section>
      <Heading level={3}>{t("Bedrooms in each building")}</Heading>

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      <ul className={listStyles.list}>
        {structures.map(structure => {
          const roomsHere = rooms.filter(r => r.structure_id === structure.id)
          const isAddingHere = addingForStructureId === structure.id
          return (
            <Card asChild key={structure.id}>
              <li>
                <Card.Block className={listStyles.addBlock}>
                  <div className={listStyles.headerRow}>
                    <strong>{structure.name}</strong>
                    {canEdit && !isAddingHere && (
                      <Button
                        type="button"
                        variant="secondary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => {
                          setAddingForStructureId(structure.id)
                          setEditingRoomId(null)
                        }}
                      >
                        {t("Add room")}
                      </Button>
                    )}
                  </div>

                  {(roomsHere.length > 0 || isAddingHere) && <Divider />}

                  {roomsHere.length > 0 && (
                    <ul className={listStyles.subList}>
                      {roomsHere.map(r => (
                        <li key={r.id} className={listStyles.subRow}>
                          <InlineEditRow
                            editing={editingRoomId === r.id}
                            canEdit={canEdit}
                            pending={pending}
                            editLabel={t("Edit room {{name}}", {
                              name: r.name,
                            })}
                            onStartEdit={() => {
                              setEditingRoomId(r.id)
                              setAddingForStructureId(null)
                            }}
                            view={
                              <span className={listStyles.rowName}>
                                {r.name}
                              </span>
                            }
                            form={renderRoomEditForm(r)}
                            actions={
                              <Button
                                variant="tertiary"
                                data-color="danger"
                                data-size="sm"
                                disabled={pending}
                                aria-label={t('Delete room "{{name}}"?', {
                                  name: r.name,
                                })}
                                onClick={() => {
                                  handleDeleteRoom(r)
                                }}
                              >
                                {t("Delete")}
                              </Button>
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {canEdit && isAddingHere && (
                    <AddBedsFlow
                      legend={t("Add a bedroom to {{name}}", {
                        name: structure.name,
                      })}
                      submitLabel={t("Add bedroom")}
                      pending={createRoom.isPending}
                      onSubmit={data => {
                        createRoom.mutate(
                          { ...data, structure_id: structure.id },
                          {
                            onSuccess: () => {
                              setAddingForStructureId(null)
                            },
                          },
                        )
                      }}
                      onCancel={() => {
                        setAddingForStructureId(null)
                      }}
                    />
                  )}
                </Card.Block>
              </li>
            </Card>
          )
        })}
      </ul>
    </section>
  )
}
