import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/administrer/")({
  beforeLoad: () => {
    throw redirect({ to: "/administrer/info", replace: true })
  },
})
