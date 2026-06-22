import { createFileRoute } from "@tanstack/react-router"
import { PersonDaysPanel } from "@/features/settlement/splitpolicybuilder/PersonDaysPanel"

export const Route = createFileRoute(
  "/_authed/administrer/fordelingspolicy/persondays",
)({
  component: PersonDaysPanel,
})
