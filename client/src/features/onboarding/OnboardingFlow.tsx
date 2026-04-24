import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  return typeof v === "string" ? Number(v) : 0
}

function fdBoolean(fd: FormData, key: string): boolean {
  return fd.get(key) === "on"
}

type Step = "user" | "property" | "ownership" | "done"

export function OnboardingFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const { data: owners } = useSuspenseQuery(
    trpc.propertyOwner.list.queryOptions(),
  )

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.propertyOwner.list.queryKey() })
  }

  const createUser = useMutation(
    trpc.user.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const createProperty = useMutation(
    trpc.property.create.mutationOptions({ onSuccess: invalidateAll }),
  )
  const upsertOwner = useMutation(
    trpc.propertyOwner.upsert.mutationOptions({ onSuccess: invalidateAll }),
  )

  const lastError =
    createUser.error ?? createProperty.error ?? upsertOwner.error
  const pending =
    createUser.isPending || createProperty.isPending || upsertOwner.isPending

  const adminUser = users[0] ?? null
  const firstProperty = properties[0] ?? null
  const firstPropertyHasOwner =
    firstProperty != null &&
    owners.some(o => o.property_id === firstProperty.id)

  const step: Step =
    adminUser == null
      ? "user"
      : firstProperty == null
        ? "property"
        : firstPropertyHasOwner
          ? "done"
          : "ownership"

  const [pctForOwner, setPctForOwner] = useState(100)

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

  const handleOwnershipSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!adminUser || !firstProperty) return
    const fd = new FormData(e.currentTarget)
    upsertOwner.mutate({
      property_id: firstProperty.id,
      user_id: adminUser.id,
      ownership_pct: fdNumber(fd, "ownership_pct"),
    })
  }

  return (
    <section>
      <h2>Welcome</h2>
      <p>Let's set up the basics. You can add more later.</p>

      <ol>
        <li>
          <strong>You (admin)</strong>
          {adminUser ? (
            <span>
              {" "}
              – {adminUser.name} ({adminUser.email})
            </span>
          ) : null}
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
        <li>
          <strong>Your ownership share</strong>
          {firstPropertyHasOwner ? <span> – set</span> : null}
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

      {step === "ownership" && adminUser && firstProperty && (
        <form onSubmit={handleOwnershipSubmit}>
          <fieldset>
            <legend>
              Step 3 – Set {adminUser.name}'s share of {firstProperty.name}
            </legend>
            <p>
              Start with 100% and split it with co-owners later, or enter a
              smaller share now if you already know the split.
            </p>
            <div>
              <label>
                Ownership %
                <input
                  type="number"
                  name="ownership_pct"
                  min={0}
                  max={100}
                  step={0.01}
                  value={pctForOwner}
                  onChange={e => {
                    setPctForOwner(Number(e.currentTarget.value))
                  }}
                  required
                />
              </label>
            </div>
            <div>
              <button type="submit" disabled={pending}>
                Save ownership
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