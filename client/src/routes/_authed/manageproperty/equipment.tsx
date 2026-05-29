import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/equipment")({
  beforeLoad: () => { throw redirect({ to: "/administrer/utstyr" }) },
})
