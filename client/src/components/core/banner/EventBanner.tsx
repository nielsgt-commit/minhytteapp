import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAuthSession } from "@/auth/auth-client"

export default function EventBanner() {
  const trpc = useTRPC()
  const auth = useAuthSession()
  const propertyId = useSelectedPropertyId()

  const enabled = auth.isAuthenticated && propertyId != null
  const { data: events } = useQuery(
    trpc.event.list.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled },
    ),
  )

  const latest = events?.[0]
  if (!latest) return null

  return (
    <aside role="status">
      {latest.body} <small>— {latest.author_name}</small>
    </aside>
  )
}