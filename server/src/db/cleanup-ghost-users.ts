import "dotenv/config"
import { eq, like, sql } from "drizzle-orm"
import { db, pool } from "./client.ts"
import {
  bookingOccupantsTable,
  bookingTable,
} from "./schema/booking.schema.ts"
import { eventTable } from "./schema/event.schema.ts"
import {
  inspectionsTable,
  maintenanceAttachmentsTable,
  maintenanceTable,
  maintenanceUpdatesTable,
} from "./schema/maintenance.schema.ts"
import {
  parkingClaimsTable,
  propertyOwnersTable,
} from "./schema/property.schema.ts"
import {
  expenseSharesTable,
  expensesTable,
  propertySplitPoliciesTable,
  settlementAcceptancesTable,
  settlementsTable,
} from "./schema/settlement.schema.ts"
import { stayTable } from "./schema/stay.schema.ts"
import {
  allowedEmailsTable,
  userGroupMembersTable,
  usersTable,
} from "./schema/users.schema.ts"

const DRY_RUN = !process.argv.includes("--apply")

type RefCheck = { table: string; column: string; count: number }

const COUNT = sql<number>`count(*)::int`

async function countReferences(user_id: number): Promise<RefCheck[]> {
  const checks: { table: string; column: string; q: Promise<{ c: number }[]> }[] = [
    {
      table: "property_owners",
      column: "user_id",
      q: db
        .select({ c: COUNT })
        .from(propertyOwnersTable)
        .where(eq(propertyOwnersTable.user_id, user_id)),
    },
    {
      table: "user_group_members",
      column: "user_id",
      q: db
        .select({ c: COUNT })
        .from(userGroupMembersTable)
        .where(eq(userGroupMembersTable.user_id, user_id)),
    },
    {
      table: "parking_claims",
      column: "user_id",
      q: db
        .select({ c: COUNT })
        .from(parkingClaimsTable)
        .where(eq(parkingClaimsTable.user_id, user_id)),
    },
    {
      table: "allowed_emails",
      column: "added_by_user_id",
      q: db
        .select({ c: COUNT })
        .from(allowedEmailsTable)
        .where(eq(allowedEmailsTable.added_by_user_id, user_id)),
    },
    {
      table: "allowed_emails",
      column: "used_by_user_id",
      q: db
        .select({ c: COUNT })
        .from(allowedEmailsTable)
        .where(eq(allowedEmailsTable.used_by_user_id, user_id)),
    },
    {
      table: "bookings",
      column: "booker_id",
      q: db
        .select({ c: COUNT })
        .from(bookingTable)
        .where(eq(bookingTable.booker_id, user_id)),
    },
    {
      table: "bookings",
      column: "cancelled_by_id",
      q: db
        .select({ c: COUNT })
        .from(bookingTable)
        .where(eq(bookingTable.cancelled_by_id, user_id)),
    },
    {
      table: "booking_occupants",
      column: "user_id",
      q: db
        .select({ c: COUNT })
        .from(bookingOccupantsTable)
        .where(eq(bookingOccupantsTable.user_id, user_id)),
    },
    {
      table: "events",
      column: "author_id",
      q: db
        .select({ c: COUNT })
        .from(eventTable)
        .where(eq(eventTable.author_id, user_id)),
    },
    {
      table: "maintenance",
      column: "added_by",
      q: db
        .select({ c: COUNT })
        .from(maintenanceTable)
        .where(eq(maintenanceTable.added_by, user_id)),
    },
    {
      table: "maintenance",
      column: "assigned_to_id",
      q: db
        .select({ c: COUNT })
        .from(maintenanceTable)
        .where(eq(maintenanceTable.assigned_to_id, user_id)),
    },
    {
      table: "maintenance_updates",
      column: "author_id",
      q: db
        .select({ c: COUNT })
        .from(maintenanceUpdatesTable)
        .where(eq(maintenanceUpdatesTable.author_id, user_id)),
    },
    {
      table: "maintenance_attachments",
      column: "uploaded_by",
      q: db
        .select({ c: COUNT })
        .from(maintenanceAttachmentsTable)
        .where(eq(maintenanceAttachmentsTable.uploaded_by, user_id)),
    },
    {
      table: "inspections",
      column: "started_by_user_id",
      q: db
        .select({ c: COUNT })
        .from(inspectionsTable)
        .where(eq(inspectionsTable.started_by_user_id, user_id)),
    },
    {
      table: "expenses",
      column: "payer_id",
      q: db
        .select({ c: COUNT })
        .from(expensesTable)
        .where(eq(expensesTable.payer_id, user_id)),
    },
    {
      table: "expenses",
      column: "reimbursed_by_id",
      q: db
        .select({ c: COUNT })
        .from(expensesTable)
        .where(eq(expensesTable.reimbursed_by_id, user_id)),
    },
    {
      table: "shares",
      column: "user_id",
      q: db
        .select({ c: COUNT })
        .from(expenseSharesTable)
        .where(eq(expenseSharesTable.user_id, user_id)),
    },
    {
      table: "settlements",
      column: "created_by_id",
      q: db
        .select({ c: COUNT })
        .from(settlementsTable)
        .where(eq(settlementsTable.created_by_id, user_id)),
    },
    {
      table: "settlement_acceptances",
      column: "head_user_id",
      q: db
        .select({ c: COUNT })
        .from(settlementAcceptancesTable)
        .where(eq(settlementAcceptancesTable.head_user_id, user_id)),
    },
    {
      table: "property_split_policies",
      column: "created_by_id",
      q: db
        .select({ c: COUNT })
        .from(propertySplitPoliciesTable)
        .where(eq(propertySplitPoliciesTable.created_by_id, user_id)),
    },
    {
      table: "stays",
      column: "user_id",
      q: db
        .select({ c: COUNT })
        .from(stayTable)
        .where(eq(stayTable.user_id, user_id)),
    },
    {
      table: "users",
      column: "parent_user_id",
      q: db
        .select({ c: COUNT })
        .from(usersTable)
        .where(eq(usersTable.parent_user_id, user_id)),
    },
  ]

  const results = await Promise.all(
    checks.map(async c => ({
      table: c.table,
      column: c.column,
      count: (await c.q)[0].c,
    })),
  )
  return results.filter(r => r.count > 0)
}

async function main() {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (pass --apply to delete)" : "APPLY"}`)

  const candidates = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      is_admin: usersTable.is_admin,
      is_head: usersTable.is_head,
      created_at: usersTable.created_at,
    })
    .from(usersTable)
    .where(like(usersTable.email, "%@oauth.local"))

  console.log(`found ${String(candidates.length)} users with @oauth.local email`)

  const ghosts: typeof candidates = []
  for (const u of candidates) {
    const refs = await countReferences(u.id)
    if (refs.length === 0) {
      ghosts.push(u)
      console.log(
        `  GHOST #${String(u.id)} email=${u.email} name="${u.name}" (no references)`,
      )
    } else {
      console.log(
        `  keep  #${String(u.id)} email=${u.email} name="${u.name}" (refs: ${refs.map(r => `${r.table}.${r.column}=${String(r.count)}`).join(", ")})`,
      )
    }
  }

  if (ghosts.length === 0) {
    console.log("\nno ghosts to delete.")
    return
  }

  if (DRY_RUN) {
    console.log(
      `\nDRY RUN: would delete ${String(ghosts.length)} ghost user(s). Re-run with --apply to actually delete.`,
    )
    return
  }

  for (const g of ghosts) {
    const [deleted] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, g.id))
      .returning({ id: usersTable.id, email: usersTable.email })
    console.log(`deleted #${String(deleted.id)} (${deleted.email})`)
  }
  console.log(`\ndeleted ${String(ghosts.length)} ghost user(s).`)
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
