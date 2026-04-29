import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import * as users from "./schema/users.schema.ts"
import * as properties from "./schema/property.schema.ts"
import * as bookings from "./schema/booking.schema.ts"
import * as maintenance from "./schema/maintenance.schema.ts"
import * as settlement from "./schema/settlement.schema.ts"
import * as events from "./schema/event.schema.ts"
import * as relations from "./schema/relations.ts"

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle({
  client: pool,
  schema: {
    ...users,
    ...properties,
    ...bookings,
    ...maintenance,
    ...settlement,
    ...events,
    ...relations,
  },
})