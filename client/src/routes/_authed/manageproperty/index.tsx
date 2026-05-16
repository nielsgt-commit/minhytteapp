import { createFileRoute } from "@tanstack/react-router"
import PropertyStats from "@/features/dashboard/propertystats/PropertyStats"

export const Route = createFileRoute("/_authed/manageproperty/")({
  component: PropertyStats,
})
