import { createFileRoute, redirect } from "@tanstack/react-router"
import { Home } from "@/features/home/Home"
import { getSession } from "@/auth/auth-client"

export const Route = createFileRoute("/_marketing/")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ["auth", "session"],
      queryFn: () => getSession().then(r => r.data),
    })
    if (session) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/dashboard" })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Home />
}
