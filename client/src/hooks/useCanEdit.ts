import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

export function useCanEdit(): boolean {
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  if (!me) return false
  return me.is_admin || me.is_head
}
