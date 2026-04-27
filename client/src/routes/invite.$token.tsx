import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { loadAuth, setPendingInvite, startLogin } from "@/auth/oauth"

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const trpc = useTRPC()
  const auth = loadAuth()

  const peek = useQuery(trpc.invite.peek.queryOptions({ token }))
  const accept = useMutation(trpc.invite.accept.mutationOptions())
  const acceptedRef = useRef(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth.isAuthenticated) return
    if (peek.data == null) return
    if (peek.data.used || peek.data.expired) return
    if (acceptedRef.current) return
    acceptedRef.current = true
    accept.mutate(
      { token },
      {
        onSuccess: () => {
          window.location.replace("/dashboard")
        },
        onError: e => {
          setAcceptError(e.message)
        },
      },
    )
  }, [auth.isAuthenticated, peek.data, accept, token])

  const handleSignIn = () => {
    setPendingInvite(token)
    startLogin()
  }

  if (peek.isLoading) return <p>Loading invite…</p>

  if (peek.error) {
    return <p role="alert">Could not load invite: {peek.error.message}</p>
  }

  if (peek.data == null) {
    return (
      <section>
        <h2>Invite not found</h2>
        <p>This link is invalid or has been revoked.</p>
      </section>
    )
  }

  if (peek.data.used) {
    return (
      <section>
        <h2>Invite already accepted</h2>
        <p>This invite has already been used.</p>
      </section>
    )
  }

  if (peek.data.expired) {
    return (
      <section>
        <h2>Invite expired</h2>
        <p>Ask the property admin to send a new one.</p>
      </section>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <section>
        <h2>You&apos;re invited</h2>
        <p>
          You&apos;ve been invited to join <strong>{peek.data.property_name}</strong>{" "}
          as <strong>{peek.data.email}</strong>.
        </p>
        <p>Sign in to accept.</p>
        <button onClick={handleSignIn}>Sign in to accept</button>
      </section>
    )
  }

  if (acceptError) {
    return (
      <section>
        <h2>Could not accept invite</h2>
        <p role="alert">{acceptError}</p>
      </section>
    )
  }

  return <p>Accepting invite…</p>
}