import { createFileRoute, redirect } from "@tanstack/react-router"
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_onboarding/onboarding")({
  loader: async ({ context }) => {
    const me = await context.queryClient
      .ensureQueryData(trpc.user.me.queryOptions())
      .catch(() => null)
    if (
      me &&
      (me.onboarding_step === "done" || me.onboarding_dismissed_at != null)
    ) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/dashboard" })
    }
    await Promise.all([
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.property.mine.queryOptions()),
    ])
  },
  component: OnboardingFlow,
})
