import "dotenv/config"
import { sql } from "drizzle-orm"
import { db, pool } from "./client.ts"

// Wipes every data row in the DB except a single keep-user row and that user's
// accounts entries (so OAuth login still recognizes them). All non-users tables
// are TRUNCATE ... RESTART IDENTITY CASCADE'd; users.parent_user_id is nulled
// to break the self-ref, then non-keep users are deleted. Auth `accounts` rows
// for other users are deleted explicitly (not truncated) so the keep-user's
// provider linkage survives.
//
// Usage:
//   pnpm tsx server/src/db/reset-prod-except-me.ts          # dry-run, prints counts
//   pnpm tsx server/src/db/reset-prod-except-me.ts --apply  # actually wipes
//
// Requires DATABASE_URL to point at the target DB. Aborts inside a transaction
// if the keep-user is not found, so a typo can't half-wipe prod.

const DRY_RUN = !process.argv.includes("--apply")
const KEEP_EMAIL = "weather@minhytte.app"

// Tables wiped wholesale. Order doesn't matter because TRUNCATE ... CASCADE
// handles dependents, but listing every table explicitly makes the blast
// radius reviewable.
const TRUNCATE_TABLES = [
  "shares",
  "settlement_user_group_totals",
  "settlement_acceptances",
  "settlement_booking_adjustments",
  "settlement_transfers",
  "property_split_policies",
  "expenses",
  "expense_categories",
  "settlements",
  "inspections",
  "maintenance",
  "equipment",
  "booking_occupants",
  "booking_rooms",
  "bookings",
  "stays",
  "events",
  "allowed_emails",
  "parking_claims",
  "property_priority_weeks",
  "property_owners",
  "property_contacts",
  "infrastructure",
  "rooms",
  "structures",
  "properties",
  "user_group_members",
  "user_groups",
  "sessions",
  "verifications",
] as const

async function countRows(table: string): Promise<number> {
  const result = await db.execute<{ c: number }>(
    sql`select count(*)::int as c from ${sql.identifier(table)}`,
  )
  return result.rows[0].c
}

async function main() {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (pass --apply to wipe)" : "APPLY"}`)
  console.log(`keep-user email: ${KEEP_EMAIL}`)

  const keep = await db.execute<{ id: number; email: string }>(
    sql`select id, email from users where email = ${KEEP_EMAIL}`,
  )
  if (keep.rows.length === 0) {
    console.error(`\nABORT: no user with email ${KEEP_EMAIL} — refusing to run.`)
    process.exitCode = 1
    return
  }
  const keepId = keep.rows[0].id
  console.log(`keep-user id: ${String(keepId)}`)

  console.log("\nrow counts before:")
  const beforeUsers = await countRows("users")
  const beforeAccounts = await countRows("accounts")
  console.log(`  users    = ${String(beforeUsers)}`)
  console.log(`  accounts = ${String(beforeAccounts)}`)
  for (const t of TRUNCATE_TABLES) {
    console.log(`  ${t.padEnd(32)} = ${String(await countRows(t))}`)
  }

  if (DRY_RUN) {
    console.log(
      `\nDRY RUN: would TRUNCATE the tables above, then keep 1 user (#${String(keepId)}) ` +
        `and that user's accounts row(s). Re-run with --apply to execute.`,
    )
    return
  }

  await db.transaction(async tx => {
    for (const t of TRUNCATE_TABLES) {
      await tx.execute(
        sql`truncate table ${sql.identifier(t)} restart identity cascade`,
      )
    }
    await tx.execute(sql`update users set parent_user_id = null`)
    await tx.execute(sql`delete from accounts where user_id <> ${keepId}`)
    await tx.execute(sql`delete from users where id <> ${keepId}`)
  })

  console.log("\nrow counts after:")
  const afterUsers = await countRows("users")
  const afterAccounts = await countRows("accounts")
  console.log(`  users    = ${String(afterUsers)}`)
  console.log(`  accounts = ${String(afterAccounts)}`)

  if (afterUsers !== 1) {
    console.error(
      `\nWARNING: expected exactly 1 user remaining, got ${String(afterUsers)}.`,
    )
    process.exitCode = 1
    return
  }
  console.log("\ndone.")
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
