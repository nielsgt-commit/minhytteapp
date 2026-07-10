// Shared harness for router-level integration tests: a fake authed context
// over a real Postgres transaction that is always rolled back, so tests never
// leave rows behind. Extracted from settlementGating.test.ts; the older test
// files (booking, expense.authz, authorization, settlementGating) still carry
// their own copies and can migrate opportunistically.

import { db } from "../db/client.ts"
import type { AuthUser, Context } from "./context.ts"

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function authUser(row: {
  id: number
  name: string
  email: string
}): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: true,
    image: null,
    is_admin: false,
    is_head_anywhere: false,
    is_head: false,
    is_child: false,
    parent_user_id: null,
    birthday: null,
    onboarding_step: null,
    onboarding_dismissed_at: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function ctxFor(tx: Tx, user: AuthUser): Context {
  return { db: tx, session: null, user } as unknown as Context
}

// For calling a service directly (they take the Db type). At runtime a
// drizzle transaction shares the whole query interface; the cast only
// bridges the nominal difference ($client exists on the pool-backed Db).
export function dbFor(tx: Tx): typeof db {
  return tx as unknown as typeof db
}

class Rollback extends Error {}

export async function withRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(async tx => {
      await fn(tx)
      throw new Rollback()
    })
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
  }
}
