import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { db } from "../db/client.ts"
import { auth } from "../auth/auth.ts"

export type AuthUser = {
  id: number
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  is_admin: boolean
  is_head: boolean
  is_child: boolean | null
  parent_user_id: number | null
  settlement_progress: "in_progress" | "all_done"
  birthday: string | null
  onboarding_step:
    | "user"
    | "basics"
    | "buildings"
    | "rooms"
    | "infrastructure"
    | "equipment"
    | "done"
    | null
  onboarding_dismissed_at: Date | null
  createdAt: Date
  updatedAt: Date
}

export const createContext = async ({ req }: FetchCreateContextFnOptions) => {
  const result = await auth.api.getSession({ headers: req.headers })
  if (!result) {
    return { db, session: null, user: null as AuthUser | null }
  }
  const raw = result.user as unknown as Omit<AuthUser, "id"> & {
    id: number | string
  }
  const user: AuthUser = { ...raw, id: Number(raw.id) }
  return { db, session: result.session, user }
}

export type Context = Awaited<ReturnType<typeof createContext>>
