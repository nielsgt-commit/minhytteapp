import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/structures")({
  beforeLoad: () => { throw redirect({ to: "/administrer/bygninger" }) },
})
