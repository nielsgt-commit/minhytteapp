import { createFileRoute } from "@tanstack/react-router"
import { Home } from "@/features/home/Home"

export const Route = createFileRoute("/_marketing/")({
  component: RouteComponent,
})

function RouteComponent() {
  return <Home />
}

