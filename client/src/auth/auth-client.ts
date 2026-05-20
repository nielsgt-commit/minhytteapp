import { createAuthClient } from "better-auth/react"
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins"
import type { Auth } from "@server/auth/auth.ts"

export const authClient = createAuthClient({
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
