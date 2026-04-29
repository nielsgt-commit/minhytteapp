import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export default function AvailableParking() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const propertyId = useAppSelector(selectSelectedPropertyId)

  const { data: properties } = useQuery(
    trpc.property.list.queryOptions(undefined, { enabled: propertyId != null }),
  )
  const { data: claims } = useQuery(
    trpc.parking.listForProperty.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled: propertyId != null },
    ),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.parking.listForProperty.queryKey() })

  const claim = useMutation(
    trpc.parking.claim.mutationOptions({ onSuccess: () => void invalidate() }),
  )
  const release = useMutation(
    trpc.parking.release.mutationOptions({ onSuccess: () => void invalidate() }),
  )

  if (propertyId == null) return null

  const property = properties?.find(p => p.id === propertyId)
  const total = property?.parking_spots ?? 0
  if (total === 0) return <p>No parking spots configured.</p>

  const claimedBySlot = new Map(
    (claims ?? []).map(c => [c.slot_index, c]),
  )
  const pending = claim.isPending || release.isPending

  const handleToggle = (slot: number, occupied: boolean) => {
    if (occupied) release.mutate({ property_id: propertyId, slot_index: slot })
    else claim.mutate({ property_id: propertyId, slot_index: slot })
  }

  return (
    <div>
      <p>Parking</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {Array.from({ length: total }, (_, slot) => {
          const occupant = claimedBySlot.get(slot)
          const occupied = occupant != null
          const title = occupied
            ? `Spot ${String(slot + 1)} — taken by ${occupant.user_name}`
            : `Spot ${String(slot + 1)} — free`
          return (
            <button
              key={slot}
              type="button"
              aria-pressed={occupied}
              title={title}
              disabled={pending}
              onClick={() => { handleToggle(slot, occupied) }}
            >
              P{slot + 1}
              {occupied ? " (taken)" : ""}
            </button>
          )
        })}
      </div>
    </div>
  )
}
