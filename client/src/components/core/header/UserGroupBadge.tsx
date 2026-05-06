import { useQuery } from "@tanstack/react-query"
import { Tag } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { useTRPC } from "@/trpc/trpc"



export default function UserGroupBadge() {
  const trpc = useTRPC()
  const selectedUserId = useAppSelector(selectSelectedUserId)
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