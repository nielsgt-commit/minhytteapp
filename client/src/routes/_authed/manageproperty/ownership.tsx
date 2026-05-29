import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/ownership")({
  beforeLoad: () => { throw redirect({ to: "/administrer/eierskap" }) },
})
