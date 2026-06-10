import { useSelectedPropertyId } from "@/selection/useSelection"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAuthSession } from "@/auth/auth-client"

import { useTranslation } from "react-i18next"
import { Dialog, Paragraph, Switch } from "@digdir/designsystemet-react"
import { startTransition, useOptimistic, useState } from "react"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"

export function CheckIn() {
  const trpc = useTRPC()
  const auth = useAuthSession()
  const propertyId = useSelectedPropertyId()
  const [welcome, setWelcome] = useState<{
    propertyName: string
    room_name: string | null
    building_name: string | null
  } | null>(null)

  const enabled = auth.isAuthenticated && propertyId != null
  const { data, isLoading } = useQuery(
    trpc.stay.currentForMe.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled },
    ),
  )

  const { t } = useTranslation("checkin")

  const invalidateKeys = [
    trpc.stay.currentForMe.queryKey(),
    trpc.stay.atProperty.queryKey(),
    trpc.booking.pathKey(),
  ]

  const checkIn = useMutationWithInvalidation(
    trpc.stay.checkIn.mutationOptions({
      onSuccess: result => {
        // Greet only on the first check-in (not a re-toggle), and only for a
        // booking that covers today — that's what tells us which room/building
        // the guest sleeps in. The greeting data rides on the mutation result,
        // so the dialog never depends on whether the background status query
        // has finished loading.
        if (result.firstCheckIn && result.kind === "booking") {
          setWelcome({
            propertyName: result.propertyName ?? "",
            room_name: result.room_name,
            building_name: result.building_name,
          })
        }
      },
    }),
    invalidateKeys,
  )
  const checkOut = useMutationWithInvalidation(
    trpc.stay.checkOut.mutationOptions(),
    invalidateKeys,
  )
  const { pending: mutating, error } = useMutationsStatus(checkIn, checkOut)

  // Show the toggled state immediately; it reverts to the server state if the
  // mutation fails (the error is surfaced in the alert below).
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(
    data?.checkedIn ?? false,
  )

  if (!enabled) return null

  const checked = optimisticChecked
  const pending = mutating || isLoading

  const handleChange = (next: boolean) => {
    startTransition(async () => {
      setOptimisticChecked(next)
      try {
        if (next) await checkIn.mutateAsync({ property_id: propertyId })
        else await checkOut.mutateAsync({ property_id: propertyId })
      } catch {
        // Reverted by useOptimistic; the error renders via <ErrorAlert>.
      }
    })
  }

  const userName = auth.user?.name ?? ""

  return (
    <>
      <Switch
        label={checked ? t("At property now") : t("At property?")}
        checked={checked}
        disabled={pending}
        onChange={e => {
          handleChange(e.currentTarget.checked)
        }}
      />
      <ErrorAlert error={error} />
      <Dialog
        modal={false}
        placement="top"
        open={welcome != null}
        onClose={() => {
          setWelcome(null)
        }}
      >
        <Dialog.Block>
          <Paragraph>
            {t("Welcome to {{property}} {{name}}", {
              property: welcome?.propertyName ?? "",
              name: userName,
            })}
            {welcome?.room_name && (
              <>
                {" "}
                {t("you sleep in {{room}} in {{building}}", {
                  room: welcome.room_name,
                  building: welcome.building_name ?? "",
                })}
              </>
            )}
          </Paragraph>
        </Dialog.Block>
      </Dialog>
    </>
  )
}
