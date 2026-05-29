import { createFileRoute } from "@tanstack/react-router"
import { PriorityWeeks } from "./-priority/PriorityWeeks"

export const Route = createFileRoute("/_authed/administrer/prioritet")({
  component: PriorityWeeks,
})
