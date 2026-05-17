import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc"
import { loadAuth } from "@/auth/oauth"
import { UserCreationForm } from "./UserCreationForm"
import { PropertyCreationForm } from "./PropertyCreationForm"

type Step = "user" | "property" | "done"

export function OnboardingFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

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

  const auth = loadAuth()
  const currentUser = auth.user
    ? users.find(u => u.oauth_sub === auth.user?.id) ?? null
    : null
  const anyUser = users[0] ?? null
  const firstProperty = properties[0] ?? null

  const step: Step =
    anyUser == null ? "user" : firstProperty == null ? "property" : "done"

  return (
    <section>
      <h2>Welcome</h2>
      <p>Let's set up the basics. You can add more later.</p>

      <ol>
        <li>
          <strong>You{currentUser?.is_admin ? " (admin)" : ""}</strong>
          {currentUser ? (
            <span>
              {" "}
              – {currentUser.name} ({currentUser.email})
            </span>
          ) : (
            <span> – not signed in</span>
          )}
        </li>
        <li>
          <strong>The property</strong>
          {firstProperty ? (
            <span>
              {" "}
              – {firstProperty.name} ({firstProperty.address})
            </span>
          ) : null}
        </li>
      </ol>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

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
          <p>All set. You can manage everything from the dashboard.</p>
          <Link to="/dashboard">Go to dashboard</Link>
        </div>
      )}
    </section>
  )
}
