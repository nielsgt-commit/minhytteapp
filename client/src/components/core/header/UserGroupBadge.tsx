import { useSelectedUserId } from "@/app/useSelectedIds"
import { useQuery } from "@tanstack/react-query"
import { Tag } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"



export default function UserGroupBadge() {
  const trpc = useTRPC()
  const selectedUserId = useSelectedUserId()
  const { data: groups } = useQuery(
    trpc.userGroup.listWithMembers.queryOptions(),
  )

  if (selectedUserId == null || !groups) return null

  const mainGroupForUser = groups.find(
    g => g.is_main && g.members.some(m => m.user_id === selectedUserId),
  )

  if (!mainGroupForUser) return null

  return <Tag data-color="info">{mainGroupForUser.name}</Tag>
}