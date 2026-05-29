import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/infrastructure")({
  beforeLoad: () => { throw redirect({ to: "/administrer/infrastruktur" }) },
})
