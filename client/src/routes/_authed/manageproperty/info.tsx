import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/info")({
  beforeLoad: () => { throw redirect({ to: "/administrer/info" }) },
})
