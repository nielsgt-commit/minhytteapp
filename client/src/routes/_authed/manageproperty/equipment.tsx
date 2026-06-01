import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/equipment")({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/administrer/utstyr" })
  },
})
