import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAuthSession } from "@/auth/auth-client"

import { useTranslation } from "react-i18next"
import { Dialog, Paragraph, Switch } from "@digdir/designsystemet-react"
import { useState } from "react"

export default function CheckIn() {
  const trpc = useTRPC()
  const qc = useQueryClient()
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

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.stay.currentForMe.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.stay.atProperty.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
  }

  const checkIn = useMutation(
    trpc.stay.checkIn.mutationOptions({
      onSuccess: result => {
        invalidate()
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
  )
  const checkOut = useMutation(
    trpc.stay.checkOut.mutationOptions({
      onSuccess: () => {
        invalidate()
      },
    }),
  )

  if (!enabled) return null

  const checked = data?.checkedIn ?? false
  const pending = checkIn.isPending || checkOut.isPending || isLoading

  const handleChange = (next: boolean) => {
    if (next) checkIn.mutate({ property_id: propertyId })
    else checkOut.mutate({ property_id: propertyId })
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
