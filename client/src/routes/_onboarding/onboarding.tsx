import { createFileRoute } from "@tanstack/react-router"
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_onboarding/onboarding")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.property.list.queryOptions()),
      context.queryClient.ensureQueryData(
        trpc.propertyOwner.list.queryOptions(),
      ),
    ]),
  component: OnboardingFlow,
})