import type { ReactNode } from "react"
import { useAuthSession } from "@/auth/auth-client"

export function HomeAuthGate({
  authenticated,
  unauthenticated,
}: {
  authenticated: ReactNode
  unauthenticated: ReactNode
}) {
  const auth = useAuthSession()
  if (auth.isPending) return null
  return auth.isAuthenticated ? authenticated : unauthenticated
}
