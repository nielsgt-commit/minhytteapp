// ============================================================
// Isomorphic Temporal helpers — imported by BOTH server and client.
//
// Constraints: only `temporal-polyfill` and `zod` imports; no node
// builtins, no server barrels, no DOM/ES-lib-specific types. This file
// is type-checked under both the client (DOM) and server (ES2023)
// tsconfig programs.
// ============================================================

import { Temporal } from "temporal-polyfill"
import { z } from "zod"

export { Temporal }

// ---- Edge converters (Drizzle rows ↔ Temporal) ----

export function instantFromDate(d: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(d.getTime())
}

export function dateFromInstant(i: Temporal.Instant): Date {
  return new Date(i.epochMilliseconds)
}

// drizzle 0.45.2 date() columns are "YYYY-MM-DD" strings (string mode +
// identity pg parsers) — direct from(); no Date union, no UTC shift.
export function plainDateFromDb(s: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(s)
}

export function plainDateToDbString(pd: Temporal.PlainDate): string {
  return pd.toString()
}

// Nullable variants for optional timestamp/date columns.
export function instantFromDateOrNull(d: Date | null): Temporal.Instant | null {
  return d == null ? null : instantFromDate(d)
}

export function plainDateFromDbOrNull(
  s: string | null,
): Temporal.PlainDate | null {
  return s == null ? null : plainDateFromDb(s)
}

// ---- Zod input schemas (router `.input(...)`) ----

export const zPlainDate = z.instanceof(Temporal.PlainDate)
export const zInstant = z.instanceof(Temporal.Instant)
