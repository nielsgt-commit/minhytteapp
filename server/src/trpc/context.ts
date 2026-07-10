import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { and, eq } from "drizzle-orm"
import { db } from "../db/client.ts"
import { auth } from "../auth/auth.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
} from "../db/schema/users.schema.ts"

export type AuthUser = {
  id: number
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  is_admin: boolean
  // Derived: true if the user is a head-flagged member of any is_family group.
  is_head_anywhere: boolean
  // Transitional alias kept equal to is_head_anywhere for client compat.
  is_head: boolean
  is_child: boolean
  parent_user_id: number | null
  birthday: string | null
  onboarding_step:
    | "user"
    | "basics"
    | "buildings"
    | "rooms"
    | "infrastructure"
    | "equipment"
    | "expenses"
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
  const raw = result.user as unknown as Omit<
    AuthUser,
    "id" | "is_head_anywhere" | "is_head"
  > & {
    id: number | string
  }
  const id = Number(raw.id)
  // Runs on every authenticated request: a single indexed LIMIT-1 lookup.
  // Consumed by headOrAdminProcedure (invite management) and echoed via
  // user.me. Deliberately not cached — head status gates authorization and
  // must be fresh (a demoted head must lose access immediately). If this ever
  // matters for latency, the lazy alternative is to move the lookup into
  // headOrAdminProcedure and derive it inside user.me instead.
  const headRows = await db
    .select({ user_group_id: userGroupMembersTable.user_group_id })
    .from(userGroupMembersTable)
    .innerJoin(
      userGroupsTable,
      eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
    )
    .where(
      and(
        eq(userGroupMembersTable.user_id, id),
        eq(userGroupMembersTable.is_head, true),
        eq(userGroupsTable.is_family, true),
      ),
    )
    .limit(1)
  const isHeadAnywhere = headRows.length > 0
  const user: AuthUser = {
    ...raw,
    id,
    is_head_anywhere: isHeadAnywhere,
    is_head: isHeadAnywhere,
  }
  return { db, session: result.session, user }
}

export type Context = Awaited<ReturnType<typeof createContext>>
