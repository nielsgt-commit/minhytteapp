import { type SyntheticEvent } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc"
import { loadAuth } from "@/auth/oauth"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdBoolean(fd: FormData, key: string): boolean {
  return fd.get(key) === "on"
}

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

  const handleUserSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createUser.mutate({
      name: fdString(fd, "name"),
      email: fdString(fd, "email"),
      is_admin: true,
      is_child: fdBoolean(fd, "is_child"),
    })
  }

  const handlePropertySubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createProperty.mutate({
      name: fdString(fd, "name"),
      address: fdString(fd, "address"),
    })
  }

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
        <form onSubmit={handleUserSubmit}>
          <fieldset>
            <legend>Step 1 – Create your admin account</legend>
            <div>
              <label>
                Name
                <input type="text" name="name" required />
              </label>
            </div>
            <div>
              <label>
                Email
                <input type="email" name="email" required />
              </label>
            </div>
            <div>
              <label>
                <input type="checkbox" name="is_child" />
                Is child
              </label>
            </div>
            <div>
              <button type="submit" disabled={pending}>
                Create admin
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {step === "property" && (
        <form onSubmit={handlePropertySubmit}>
          <fieldset>
            <legend>Step 2 – Add the property</legend>
            <div>
              <label>
                Name
                <input type="text" name="name" required />
              </label>
            </div>
            <div>
              <label>
                Address
                <input type="text" name="address" required />
              </label>
            </div>
            <div>
              <button type="submit" disabled={pending}>
                Create property
              </button>
            </div>
          </fieldset>
        </form>
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