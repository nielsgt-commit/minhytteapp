import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useSelectedPropertyId } from "@/selection/useSelection"

export function useCanEdit(propertyId?: number): boolean {
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const selectedPropertyId = useSelectedPropertyId()
  if (!me) return false
  if (me.is_admin) return true
  const pid = propertyId ?? selectedPropertyId
  return pid != null && me.head_property_ids.includes(pid)
}
