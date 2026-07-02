import { createFileRoute } from "@tanstack/react-router"
import { ManageSeasons } from "@/features/seasons/ManageSeasons.tsx"

export const Route = createFileRoute("/_authed/administrer/sesonger")({
  component: ManageSeasons,
})
