import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { UserCreationForm } from "./UserCreationForm"
import { PropertyCreationForm } from "./PropertyCreationForm"

type Step = "user" | "property" | "done"

export function OnboardingFlow() {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const onboardingKeys = [
    trpc.user.list.queryKey(),
    trpc.property.mine.queryKey(),
  ]
  const createUser = useMutationWithInvalidation(
    trpc.user.create.mutationOptions(),
    onboardingKeys,
  )
  const createProperty = useMutationWithInvalidation(
    trpc.property.create.mutationOptions(),
    onboardingKeys,
  )

  const lastError = createUser.error ?? createProperty.error

  const currentUser = me ?? null
  const anyUser = users.at(0) ?? null
  const firstProperty = properties.at(0) ?? null

  const step: Step =
    anyUser == null ? "user" : firstProperty == null ? "property" : "done"

  return (
    <section>
      <h2>{t("Welcome")}</h2>
      <p>{t("Let's set up the basics. You can add more later.")}</p>

      <ol>
        <li>
          <strong>{currentUser?.is_admin ? t("You (admin)") : t("You")}</strong>
          {currentUser ? (
            <span>
              {" "}
              – {currentUser.name} ({currentUser.email})
            </span>
          ) : (
            <span> – {t("not signed in")}</span>
          )}
        </li>
        <li>
          <strong>{t("The property")}</strong>
          {firstProperty ? (
            <span>
              {" "}
              – {firstProperty.name} ({firstProperty.address})
            </span>
          ) : null}
        </li>
      </ol>

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      {step === "user" && (
        <UserCreationForm
          onSubmit={async input => {
            await createUser.mutateAsync({ ...input, is_admin: true })
          }}
        />
      )}

      {step === "property" && (
        <PropertyCreationForm
          onSubmit={async input => {
            await createProperty.mutateAsync(input)
          }}
        />
      )}

      {step === "done" && (
        <div>
          <p>{t("All set. You can manage everything from the dashboard.")}</p>
          <Link to="/dashboard">{t("Go to dashboard")}</Link>
        </div>
      )}
    </section>
  )
}
