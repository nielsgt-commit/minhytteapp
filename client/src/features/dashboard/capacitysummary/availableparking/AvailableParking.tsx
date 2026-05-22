import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@digdir/designsystemet-react"
import {
  BicycleIcon,
  CarFillIcon,
  CarIcon,
  MotorcycleFillIcon,
  MotorcycleIcon,
  StrollerFillIcon,
  StrollerIcon,
} from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./AvailableParking.module.css"
import { useParking } from "./useParking"
import { useTRPC } from "@/trpc/trpc.ts"
import { WheelbarrowFillIcon, WheelbarrowIcon } from "./WheelbarrowIcon"

const EXTRA_SLOT_BASE = 1000

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

type ExtraVehicle = {
  offset: number
  labelKey: "Motorcycle" | "Bicycle" | "Stroller" | "Wheelbarrow"
  Icon: IconComponent
  FillIcon: IconComponent
}

const EXTRAS: readonly ExtraVehicle[] = [
  { offset: 0, labelKey: "Motorcycle", Icon: MotorcycleIcon, FillIcon: MotorcycleFillIcon },
  { offset: 1, labelKey: "Bicycle", Icon: BicycleIcon, FillIcon: BicycleIcon },
  { offset: 2, labelKey: "Stroller", Icon: StrollerIcon, FillIcon: StrollerFillIcon },
  { offset: 3, labelKey: "Wheelbarrow", Icon: WheelbarrowIcon, FillIcon: WheelbarrowFillIcon },
]

export default function AvailableParking() {
  const { t } = useTranslation("dashboard")
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

  const claimedBySlot = new Map((claims ?? []).map(c => [c.slot_index, c]))

  return (
    <div className={styles.wrap}>
      <div className={styles.slots}>
        {total === 0 ? (
          <p>{t("No parking spots configured.")}</p>
        ) : (
          Array.from({ length: total }, (_, slot) => {
            const occupant = claimedBySlot.get(slot)
            const occupied = occupant != null
            const title = occupied
              ? t("Spot {{slot}} — taken by {{userName}}", { slot: slot + 1, userName: occupant.user_name })
              : t("Spot {{slot}} — free", { slot: slot + 1 })
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
          })
        )}
        {EXTRAS.map(({ offset, labelKey, Icon, FillIcon }) => {
          const slot = EXTRA_SLOT_BASE + offset
          const occupant = claimedBySlot.get(slot)
          const occupied = occupant != null
          const vehicle = t(labelKey)
          const title = occupied
            ? t("{{vehicle}} — taken by {{userName}}", {
                vehicle,
                userName: occupant.user_name,
              })
            : t("{{vehicle}} — free", { vehicle })
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
              {occupied ? <FillIcon aria-hidden /> : <Icon aria-hidden />}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
