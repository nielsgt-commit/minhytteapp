import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow"
import { trpc } from "@/trpc/client"

const searchSchema = z.object({
  preview: z.coerce.boolean().optional(),
})

export const Route = createFileRoute("/_onboarding/onboarding")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ preview: search.preview ?? false }),
  loader: async ({ context, deps }) => {
    const me = await context.queryClient
      .ensureQueryData(trpc.user.me.queryOptions())
      .catch(() => null)
    // `?preview=1` lets developers re-enter the wizard even after they've
    // finished or dismissed it, without resetting their user row.
    if (
      !deps.preview &&
      me &&
      (me.onboarding_step === "done" || me.onboarding_dismissed_at != null)
    ) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/oversikt" })
    }
    await context.queryClient.ensureQueryData(trpc.property.mine.queryOptions())
  },
  component: OnboardingRoute,
})

function OnboardingRoute() {
  const { preview } = Route.useSearch()
  return <OnboardingFlow preview={preview ?? false} />
}
