import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/priority")({
  beforeLoad: () => { throw redirect({ to: "/administrer/prioritet" }) },
})
