import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { loadAuth } from "@/auth/oauth"

export default function EventBanner() {
  const trpc = useTRPC()
  const auth = loadAuth()
  const propertyId = useAppSelector(selectSelectedPropertyId)

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