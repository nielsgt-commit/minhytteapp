import { createFileRoute } from "@tanstack/react-router"
import { SplitPolicyBuilder } from "@/features/settlement/splitpolicybuilder/SplitPolicyBuilder"

export const Route = createFileRoute("/_authed/manageproperty/split-policy")({
  component: SplitPolicyBuilder,
})
