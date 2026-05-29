import { createFileRoute } from "@tanstack/react-router"
import { UserSettings } from "@/features/usersettings/UserSettings"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/innstillinger")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(trpc.user.me.queryOptions()),
      context.queryClient.ensureQueryData(
        trpc.user.listMyChildren.queryOptions(),
      ),
    ]),
  component: UserSettings,
})
