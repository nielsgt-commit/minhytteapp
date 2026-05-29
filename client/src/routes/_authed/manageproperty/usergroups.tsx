import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/usergroups")({
  beforeLoad: () => { throw redirect({ to: "/administrer/brukergrupper" }) },
})
