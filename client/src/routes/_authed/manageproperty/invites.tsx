import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/invites")({
  beforeLoad: () => { throw redirect({ to: "/administrer/invitasjoner" }) },
})
