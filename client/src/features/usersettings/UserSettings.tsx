import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { ProfileSection } from "./ProfileSection"
import { ChildrenSection } from "./ChildrenSection"

export function UserSettings() {
  const trpc = useTRPC()

  const { data: me } = useQuery(trpc.user.me.queryOptions())

  if (!me) return <p>Loading…</p>

  return (
    <section>
      <h1>User settings</h1>
      <ProfileSection me={me} />
      <ChildrenSection />
    </section>
  )
}
