import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { AddBedsFlow } from "@/features/property/testform/AddBedsFlow"

type Props = {
  propertyId: number
  onContinue: () => void
}

export function BedroomsStep({ propertyId, onContinue }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()

  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const createRoom = useMutationWithInvalidation(
    trpc.room.create.mutationOptions(),
    [trpc.room.listForProperty.queryKey({ property_id: propertyId })],
  )

  const [addingForStructureId, setAddingForStructureId] = useState<
    number | null
  >(null)

  if (structures.length === 0) {
    return (
      <section>
        <Heading level={3}>{t("Bedrooms")}</Heading>
        <p>{t("No buildings yet — skip ahead, you can add rooms later.")}</p>
        <Button type="button" onClick={onContinue}>
          {t("Continue")}
        </Button>
      </section>
    )
  }

  return (
    <section>
      <Heading level={3}>{t("Bedrooms in each building")}</Heading>

      {structures.map(structure => {
        const roomsHere = rooms.filter(r => r.structure_id === structure.id)
        const isAddingHere = addingForStructureId === structure.id
        return (
          <div key={structure.id}>
            <Heading level={4}>{structure.name}</Heading>
            {roomsHere.length > 0 && (
              <ul>
                {roomsHere.map(r => (
                  <li key={r.id}>{r.name}</li>
                ))}
              </ul>
            )}

            {isAddingHere ? (
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
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAddingForStructureId(structure.id)
                }}
              >
                {roomsHere.length === 0
                  ? t("Add a bedroom")
                  : t("Add another bedroom")}
              </Button>
            )}
          </div>
        )
      })}

      {createRoom.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: createRoom.error.message })}
        </p>
      )}

      <div>
        <Button type="button" onClick={onContinue}>
          {rooms.length === 0 ? t("Skip for now") : t("Continue")}
        </Button>
      </div>
    </section>
  )
}
