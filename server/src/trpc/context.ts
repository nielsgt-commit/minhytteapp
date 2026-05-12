import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { eq } from "drizzle-orm"
import { db } from "../db/client.ts"
import { usersTable } from "../db/schema/users.schema.ts"

export type AuthUser = {
  id: number
  name: string
  email: string
  is_admin: boolean
  is_head: boolean
  settlement_progress: "in_progress" | "all_done"
  birthday: string | null
}

export type AuthClaims = {
  sub: string
  name?: string
  email?: string
}

function extractClaims(authHeader: string | null): AuthClaims | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(" ")
  if (scheme.toLowerCase() !== "bearer" || !token) return null
  const [, payload] = token.split(".")
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const json = Buffer.from(normalized, "base64").toString("utf8")
    const raw = JSON.parse(json) as Record<string, unknown>
    if (typeof raw.sub !== "string") return null
    return {
      sub: raw.sub,
      name: typeof raw.name === "string" ? raw.name : undefined,
      email: typeof raw.email === "string" ? raw.email : undefined,
    }
  } catch {
    return null
  }
}

async function lookupUser(sub: string | null): Promise<AuthUser | null> {
  if (!sub) return null
  const row = (
    await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        is_admin: usersTable.is_admin,
        is_head: usersTable.is_head,
        settlement_progress: usersTable.settlement_progress,
        birthday: usersTable.birthday,
      })
      .from(usersTable)
      .where(eq(usersTable.oauth_sub, sub))
      .limit(1)
  ).at(0)
  return row ?? null
}

export const createContext = async ({ req }: FetchCreateContextFnOptions) => {
  const claims = extractClaims(req.headers.get("authorization"))
  return {
    db,
    claims,
    user: await lookupUser(claims?.sub ?? null),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>