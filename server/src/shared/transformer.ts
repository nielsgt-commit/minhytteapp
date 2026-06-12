// ============================================================
// Dedicated SuperJSON instance for the tRPC wire — serializes Temporal
// values natively so both ends hold real Temporal instances.
//
// Isomorphic: imported by `server/src/trpc/init.ts` and
// `client/src/trpc/client.ts`. Only `superjson` + `temporal-polyfill`.
// ============================================================

import { SuperJSON } from "superjson"
import { Temporal } from "temporal-polyfill"

export const transformer = new SuperJSON()

transformer.registerCustom<Temporal.PlainDate, string>(
  {
    isApplicable: (v): v is Temporal.PlainDate =>
      v instanceof Temporal.PlainDate,
    serialize: v => v.toString(),
    deserialize: s => Temporal.PlainDate.from(s),
  },
  "Temporal.PlainDate",
)

transformer.registerCustom<Temporal.Instant, string>(
  {
    isApplicable: (v): v is Temporal.Instant => v instanceof Temporal.Instant,
    serialize: v => v.toString(),
    deserialize: s => Temporal.Instant.from(s),
  },
  "Temporal.Instant",
)

transformer.registerCustom<Temporal.PlainDateTime, string>(
  {
    isApplicable: (v): v is Temporal.PlainDateTime =>
      v instanceof Temporal.PlainDateTime,
    serialize: v => v.toString(),
    deserialize: s => Temporal.PlainDateTime.from(s),
  },
  "Temporal.PlainDateTime",
)
