import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { UserCreationForm } from "./UserCreationForm"
import { PropertyCreationForm } from "./PropertyCreationForm"

type Step = "user" | "property" | "done"

export function OnboardingFlow() {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
  }

  const createUser = useMutation(
    trpc.user.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const createProperty = useMutation(
    trpc.property.create.mutationOptions({ onSuccess: invalidateAll }),
  )

  const lastError = createUser.error ?? createProperty.error
  const pending = createUser.isPending || createProperty.isPending

  const currentUser = me ?? null
  const anyUser = users[0] ?? null
  const firstProperty = properties[0] ?? null

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

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      {step === "user" && (
        <UserCreationForm
          pending={pending}
          onSubmit={input => { createUser.mutate({ ...input, is_admin: true }) }}
        />
      )}

      {step === "property" && (
        <PropertyCreationForm
          pending={pending}
          onSubmit={input => { createProperty.mutate(input) }}
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
