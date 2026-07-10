// Factory for the per-router toWire converters that uphold the Temporal wire
// convention: DB rows leave a handler with Temporal values, never raw JS
// Dates. Instead of hand-listing timestamp columns in ~20 near-identical
// functions, a router declares a spec once:
//
//   const toWireTodo = wireMap({ created_at: "instant" })
//
// The generic guard makes a FORGOTTEN Date column a compile error at the call
// site (the historical failure mode: a new timestamp column silently shipped
// as a raw Date). Two documented limits:
//
// 1. `plainDate` string columns cannot be guarded — a "YYYY-MM-DD" string is
//    indistinguishable from any other string at the type level. A forgotten
//    date-string column ships as a string (harmless to the superjson wire
//    contract, unlike a Date).
// 2. Nullability is one-directional: a NOT NULL Date column marked
//    `instantOrNull` type-checks and just widens the output to `| null`; the
//    reverse (nullable column marked `instant`) correctly fails.
//
// Server-edge-only: lives in trpc/util (not shared/temporal.ts, which is part
// of the isomorphic kernel and deliberately minimal).

import {
  type Temporal,
  instantFromDate,
  instantFromDateOrNull,
  plainDateFromDb,
  plainDateFromDbOrNull,
} from "../../shared/temporal.ts"

const converters = {
  instant: instantFromDate,
  instantOrNull: instantFromDateOrNull,
  plainDate: plainDateFromDb,
  plainDateOrNull: plainDateFromDbOrNull,
} as const

type WireKind = keyof typeof converters

type WireIn = {
  instant: Date
  instantOrNull: Date | null
  plainDate: string
  plainDateOrNull: string | null
}
type WireOut = {
  instant: Temporal.Instant
  instantOrNull: Temporal.Instant | null
  plainDate: Temporal.PlainDate
  plainDateOrNull: Temporal.PlainDate | null
}

// Keys of T that still hold a raw JS Date (the bug class this factory kills).
type DateKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends Date ? K : never
}[keyof T]

export function wireMap<S extends Record<string, WireKind>>(spec: S) {
  return function toWire<T extends { [K in keyof S]: WireIn[S[K]] }>(
    // Second intersection member rejects rows with Date columns not in the
    // spec: a forgotten timestamp is a COMPILE error, not a silent raw Date
    // on the wire.
    row: T &
      ([Exclude<DateKeys<T>, keyof S>] extends [never]
        ? unknown
        : {
            "ERROR: unmapped Date column(s)": Exclude<DateKeys<T>, keyof S>
          }),
  ): Omit<T, keyof S> & { [K in keyof S]: WireOut[S[K]] } {
    const out: Record<string, unknown> = { ...row }
    for (const key of Object.keys(spec)) {
      out[key] = (converters[spec[key]] as (v: unknown) => unknown)(
        (row as Record<string, unknown>)[key],
      )
    }
    return out as Omit<T, keyof S> & { [K in keyof S]: WireOut[S[K]] }
  }
}
