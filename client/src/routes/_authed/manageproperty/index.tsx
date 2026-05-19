import { createFileRoute, Navigate } from "@tanstack/react-router"
import PropertyStats from "@/features/dashboard/propertystats/PropertyStats"
import { useIsMobile } from "@/hooks/useIsMobile"

function ManagePropertyIndex() {
  const isMobile = useIsMobile()
  if (isMobile) return <Navigate to="/manageproperty/info" replace />
  return <PropertyStats />
}

export const Route = createFileRoute("/_authed/manageproperty/")({
  component: ManagePropertyIndex,
})
