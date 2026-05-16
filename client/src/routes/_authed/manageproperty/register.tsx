import { createFileRoute } from "@tanstack/react-router"
import { PropertyRegister } from "@/features/property/register/PropertyRegister"

export const Route = createFileRoute("/_authed/manageproperty/register")({
  component: PropertyRegister,
})
