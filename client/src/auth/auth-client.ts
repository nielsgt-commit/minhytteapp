import { createAuthClient } from "better-auth/react"
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins"
import type { Auth } from "@server/auth/auth.ts"

export const authClient = createAuthClient({
  // Send the session cookie on every auth request (sign-out, get-session,
  // sign-in). Same-origin requests include it by default, but making it
  // explicit matches the tRPC client (which sets credentials: "include")
  // and guards against any edge case where the request is treated as
  // cross-origin — otherwise sign-out can't clear a cookie it never sends.
  fetchOptions: { credentials: "include" },
  plugins: [magicLinkClient(), inferAdditionalFields<Auth>()],
})

export const { useSession, signIn, signOut, getSession } = authClient

export function useAuthSession() {
  const { data, isPending, error } = useSession()
  return {
    isAuthenticated: !!data?.user,
    user: data?.user ?? null,
    isPending,
    error,
  }
}
