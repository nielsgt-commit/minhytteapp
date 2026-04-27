import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { completeLogin, takePendingInvite } from "@/auth/oauth"
import { trpcClient } from "@/trpc/client"

export const Route = createFileRoute("/auth/callback")({
  component: CallbackPage,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : "",
    state: typeof search.state === "string" ? search.state : "",
  }),
})

function CallbackPage() {
  const { code, state } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (!code || !state) {
      setError("Missing code or state in callback URL")
      return
    }
    completeLogin(code, state)
      .then(() => trpcClient.user.bootstrap.mutate())
      .then(() => {
        const inviteToken = takePendingInvite()
        const dest = inviteToken ? `/invite/${inviteToken}` : "/dashboard"
        window.location.replace(dest)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Login failed")
      })
  }, [code, state])

  if (error) return <p>Login failed: {error}</p>
  return <p>Signing in…</p>
}