import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@digdir/designsystemet-react"
import { CarFillIcon, CarIcon } from "@navikt/aksel-icons"
import styles from "./AvailableParking.module.css"
import { useParking } from "./useParking"
import { useTRPC } from "@/trpc/trpc.ts"

export default function AvailableParking() {
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()

  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: properties } = useQuery(
    trpc.property.list.queryOptions(undefined, { enabled: propertyId != null }),
  )
  const { data: claims } = useQuery(
    trpc.parking.listForProperty.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled: propertyId != null },
    ),
  )

  const { toggle, pendingSlot } = useParking(propertyId ?? 0, me)

  if (propertyId == null) return null

  const property = properties?.find(p => p.id === propertyId)
  const total = property?.parking_spots ?? 0
  if (total === 0) return <p>No parking spots configured.</p>

  const claimedBySlot = new Map((claims ?? []).map(c => [c.slot_index, c]))

  return (
    <div className={styles.wrap}>
      <div className={styles.slots}>
        {Array.from({ length: total }, (_, slot) => {
          const occupant = claimedBySlot.get(slot)
          const occupied = occupant != null
          const title = occupied
            ? `Spot ${String(slot + 1)} — taken by ${occupant.user_name}`
            : `Spot ${String(slot + 1)} — free`
          return (
            <Button
              key={slot}
              icon
              variant="tertiary"
              data-color={occupied ? undefined : "neutral"}
              type="button"
              aria-pressed={occupied}
              aria-label={title}
              title={title}
              disabled={pendingSlot === slot}
              onClick={() => {
                toggle(slot, occupied)
              }}
            >
              {occupied ? <CarFillIcon aria-hidden /> : <CarIcon aria-hidden />}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
