import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/infrastructure")({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/administrer/infrastruktur" })
  },
})
