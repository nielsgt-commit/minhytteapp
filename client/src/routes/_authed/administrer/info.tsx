import { createFileRoute } from "@tanstack/react-router"
import { PropertyInfo } from "@/features/property/propertyinfo/PropertyInfo"

export const Route = createFileRoute("/_authed/administrer/info")({
  component: PropertyInfo,
})
