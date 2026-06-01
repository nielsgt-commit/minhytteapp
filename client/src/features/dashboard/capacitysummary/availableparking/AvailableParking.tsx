import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@digdir/designsystemet-react"
import {
  CarFillIcon,
  CarIcon,
  MotorcycleFillIcon,
  MotorcycleIcon,
} from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./AvailableParking.module.css"
import { useParking } from "./useParking"
import { useTRPC } from "@/trpc/trpc.ts"

const EXTRA_SLOT_BASE = 1000

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

type ExtraVehicle = {
  offset: number
  labelKey: "Motorcycle"
  Icon: IconComponent
  FillIcon: IconComponent
}

// typescript-eslint's project service occasionally reports the Aksel icon
// imports as "error typed"; tsc is happy, but we cast through unknown to
// keep the lint rule satisfied.
const asIcon = (c: unknown): IconComponent => c as IconComponent

const EXTRAS: readonly ExtraVehicle[] = [
  {
    offset: 0,
    labelKey: "Motorcycle",
    Icon: asIcon(MotorcycleIcon),
    FillIcon: asIcon(MotorcycleFillIcon),
  },
]

export default function AvailableParking() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()

  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: properties } = useQuery(
    trpc.property.mine.queryOptions(undefined, { enabled: propertyId != null }),
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
              ? t("Spot {{slot}} — taken by {{userName}}", {
                  slot: slot + 1,
                  userName: occupant.user_name,
                })
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
                {occupied ? (
                  <CarFillIcon aria-hidden />
                ) : (
                  <CarIcon aria-hidden />
                )}
              </Button>
            )
          })
        )}
        {EXTRAS.map(({ offset, labelKey, Icon, FillIcon }) => {
          const slot = EXTRA_SLOT_BASE + offset
          const occupant = claimedBySlot.get(slot)
          const occupied = occupant != null
          const vehicleLabels = {
            Motorcycle: t("Motorcycle"),
          } satisfies Record<typeof labelKey, string>
          const vehicle = vehicleLabels[labelKey]
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
