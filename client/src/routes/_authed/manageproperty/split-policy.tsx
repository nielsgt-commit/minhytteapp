import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/manageproperty/split-policy")({
  beforeLoad: () => { throw redirect({ to: "/administrer/fordelingspolicy" }) },
})
