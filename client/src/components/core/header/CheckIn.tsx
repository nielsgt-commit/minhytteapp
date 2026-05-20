import { useSelectedPropertyId } from "@/app/useSelectedIds"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAuthSession } from "@/auth/auth-client"

import { Switch } from '@digdir/designsystemet-react';

export default function CheckIn() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const auth = useAuthSession()
  const propertyId = useSelectedPropertyId()

  const enabled = auth.isAuthenticated && propertyId != null
  const { data, isLoading } = useQuery(
    trpc.stay.currentForMe.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled },
    ),
  )

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.stay.currentForMe.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.stay.atProperty.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
  }

  const checkIn = useMutation(
    trpc.stay.checkIn.mutationOptions({ onSuccess: () => { invalidate() } }),
  )
  const checkOut = useMutation(
    trpc.stay.checkOut.mutationOptions({ onSuccess: () => { invalidate() } }),
  )

  if (!enabled) return null

  const checked = data?.checkedIn ?? false
  const pending = checkIn.isPending || checkOut.isPending || isLoading

  const handleChange = (next: boolean) => {
    if (propertyId == null) return
    if (next) checkIn.mutate({ property_id: propertyId })
    else checkOut.mutate({ property_id: propertyId })
  }

  return (
    <Switch
      label={checked ? "På hytta nå" : "På hytta?"}
      checked={checked}
      disabled={pending}
      onChange={e => { handleChange(e.currentTarget.checked) }}
    />
  )
}
