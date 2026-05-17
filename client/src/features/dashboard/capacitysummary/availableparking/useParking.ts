import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"

type ClaimList = {
  property_id: number
  slot_index: number
  user_id: number
  user_name: string
  claimed_at: string
}[]

type Me = { id: number; name: string } | null | undefined

export function useParking(propertyId: number, me: Me) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const queryKey = trpc.parking.listForProperty.queryKey({
    property_id: propertyId,
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

  const pendingSlot = claim.isPending
    ? claim.variables?.slot_index
    : release.isPending
      ? release.variables?.slot_index
      : null

  const toggle = (slot: number, occupied: boolean) => {
    if (occupied) release.mutate({ property_id: propertyId, slot_index: slot })
    else claim.mutate({ property_id: propertyId, slot_index: slot })
  }

  return { toggle, pendingSlot }
}
