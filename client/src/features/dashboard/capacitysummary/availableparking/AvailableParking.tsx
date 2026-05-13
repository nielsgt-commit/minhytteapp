import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, Heading } from "@digdir/designsystemet-react"
import { CarFillIcon, CarIcon } from "@navikt/aksel-icons"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

type ClaimList = {
  property_id: number
  slot_index: number
  user_id: number
  user_name: string
  claimed_at: string
}[]

export default function AvailableParking() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const propertyId = useAppSelector(selectSelectedPropertyId)

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

  const queryKey = trpc.parking.listForProperty.queryKey({
    property_id: propertyId ?? 0,
  })

  const settle = () =>
    qc.invalidateQueries({ queryKey: trpc.parking.listForProperty.queryKey() })

  const claim = useMutation(
    trpc.parking.claim.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey })
        const previous = qc.getQueryData<ClaimList>(queryKey)
        if (me) {
          qc.setQueryData<ClaimList>(queryKey, old => {
            const without = (old ?? []).filter(
              c => c.slot_index !== vars.slot_index,
            )
            return [
              ...without,
              {
                property_id: vars.property_id,
                slot_index: vars.slot_index,
                user_id: me.id,
                user_name: me.name,
                claimed_at: new Date().toISOString(),
              },
            ].sort((a, b) => a.slot_index - b.slot_index)
          })
        }
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx.previous) qc.setQueryData(queryKey, ctx.previous)
      },
      onSettled: () => void settle(),
    }),
  )
  const release = useMutation(
    trpc.parking.release.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey })
        const previous = qc.getQueryData<ClaimList>(queryKey)
        qc.setQueryData<ClaimList>(queryKey, old =>
          (old ?? []).filter(c => c.slot_index !== vars.slot_index),
        )
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx.previous) qc.setQueryData(queryKey, ctx.previous)
      },
      onSettled: () => void settle(),
    }),
  )

  if (propertyId == null) return null

  const property = properties?.find(p => p.id === propertyId)
  const total = property?.parking_spots ?? 0
  if (total === 0) return <p>No parking spots configured.</p>

  const claimedBySlot = new Map((claims ?? []).map(c => [c.slot_index, c]))
  const pendingSlot = claim.isPending
    ? claim.variables?.slot_index
    : release.isPending
      ? release.variables?.slot_index
      : null

  const handleToggle = (slot: number, occupied: boolean) => {
    if (occupied) release.mutate({ property_id: propertyId, slot_index: slot })
    else claim.mutate({ property_id: propertyId, slot_index: slot })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Heading level={6} size="medium">Cars</Heading>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                handleToggle(slot, occupied)
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
