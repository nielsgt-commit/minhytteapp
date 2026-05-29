import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/contacts")({
  beforeLoad: () => { throw redirect({ to: "/administrer/kontakter" }) },
})
