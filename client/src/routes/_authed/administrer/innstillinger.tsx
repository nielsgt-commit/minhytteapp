import { createFileRoute } from "@tanstack/react-router"
import { DangerZone } from "@/features/property/dangerzone/DangerZone"

export const Route = createFileRoute("/_authed/administrer/innstillinger")({
  component: DangerZone,
})
