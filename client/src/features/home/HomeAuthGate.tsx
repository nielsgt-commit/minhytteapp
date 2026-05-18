import type { ReactNode } from "react"
import { loadAuth } from "@/auth/oauth"

export function HomeAuthGate({
  authenticated,
  unauthenticated,
}: {
  authenticated: ReactNode
  unauthenticated: ReactNode
}) {
  const auth = loadAuth()
  return auth.isAuthenticated && auth.user ? authenticated : unauthenticated
}
