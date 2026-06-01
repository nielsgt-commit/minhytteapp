import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/usergroups")({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/administrer/brukergrupper" })
  },
})
