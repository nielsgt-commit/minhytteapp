import "dotenv/config"
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { normalizeEmail } from "../auth/email.ts"
import { db, pool } from "./client.ts"
import { allowedEmailsTable, usersTable } from "./schema/users.schema.ts"

// Three-step reset of the connected DB:
//   1. DROP SCHEMA public CASCADE + DROP SCHEMA drizzle CASCADE, then recreate
//      public. Wipes every table, sequence, and drizzle's own migrations
//      tracker so the next migrate() applies all migrations from scratch.
//   2. Apply every drizzle migration from ./drizzle programmatically.
//   3. Seed admin user (weather@minhytte.app, is_admin=true,
//      email_verified=true) and the matching allowed_emails row, so magic-link
//      sign-in works immediately.
//
// Usage:
//   pnpm tsx server/src/db/reset-prod.ts          # dry-run, prints current state
//   pnpm tsx server/src/db/reset-prod.ts --apply  # actually wipe + rebuild
//
// DATABASE_URL controls the target. Point at a local DB to test, point at the
// prod External URL to nuke prod. The script does NOT confirm which DB it's
// talking to beyond what's in DATABASE_URL — that's on you.

const DRY_RUN = !process.argv.includes("--apply")
const ADMIN_NAME = "Admin"
const ADMIN_EMAIL = normalizeEmail("weather@minhytte.app")
const MIGRATIONS_FOLDER = "./drizzle"

async function listPublicTables(): Promise<string[]> {
  const r = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' order by tablename`,
  )
  return r.rows.map(row => row.tablename)
}

async function countUsersIfExists(): Promise<number | null> {
  const exists = await db.execute<{ exists: boolean }>(
    sql`select exists (
          select 1 from pg_tables where schemaname = 'public' and tablename = 'users'
        ) as exists`,
  )
  if (!exists.rows[0].exists) return null
  const r = await db.execute<{ c: number }>(
    sql`select count(*)::int as c from users`,
  )
  return r.rows[0].c
}

async function seedAdmin(): Promise<void> {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL))
    .limit(1)

  let admin_id: number
  if (existing.length > 0) {
    admin_id = existing[0].id
    console.log(`  admin user already exists #${String(admin_id)}`)
  } else {
    const [inserted] = await db
      .insert(usersTable)
      .values({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        email_verified: true,
        is_admin: true,
      })
      .returning({ id: usersTable.id })
    admin_id = inserted.id
    console.log(`  inserted admin user #${String(admin_id)}`)
  }

  const existingAllowed = await db
    .select({ id: allowedEmailsTable.id })
    .from(allowedEmailsTable)
    .where(eq(allowedEmailsTable.email, ADMIN_EMAIL))
    .limit(1)

  if (existingAllowed.length > 0) {
    console.log(`  allowed-list entry already exists`)
  } else {
    await db.insert(allowedEmailsTable).values({
      email: ADMIN_EMAIL,
      added_by_user_id: admin_id,
    })
    console.log(`  inserted allowed-list entry`)
  }
}

async function main(): Promise<void> {
  console.log(
    `mode: ${DRY_RUN ? "DRY RUN (pass --apply to wipe + rebuild)" : "APPLY"}`,
  )
  console.log(`admin email: ${ADMIN_EMAIL}`)
  console.log(`migrations folder: ${MIGRATIONS_FOLDER}`)

  const tablesBefore = await listPublicTables()
  const usersBefore = await countUsersIfExists()
  console.log(`\ncurrent state:`)
  console.log(`  tables in public schema: ${String(tablesBefore.length)}`)
  console.log(
    `  users row count: ${usersBefore === null ? "(no users table)" : String(usersBefore)}`,
  )

  if (DRY_RUN) {
    console.log(`\nDRY RUN: on --apply would:`)
    console.log(
      `  1. drop schema public cascade + drop schema if exists drizzle cascade + create schema public`,
    )
    console.log(`  2. apply all drizzle migrations from ${MIGRATIONS_FOLDER}`)
    console.log(
      `  3. seed admin user + allowed-emails entry for ${ADMIN_EMAIL}`,
    )
    console.log(`\nRe-run with --apply to execute.`)
    return
  }

  console.log(`\nstep 1: drop + recreate schemas`)
  await db.execute(sql`drop schema if exists drizzle cascade`)
  await db.execute(sql`drop schema public cascade`)
  await db.execute(sql`create schema public`)
  console.log(`  schemas reset`)

  console.log(`\nstep 2: applying migrations`)
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  console.log(`  migrations applied`)

  console.log(`\nstep 3: seeding admin`)
  await seedAdmin()

  const usersAfter = await countUsersIfExists()
  console.log(`\nfinal state:`)
  console.log(`  users row count: ${String(usersAfter)}`)

  if (usersAfter !== 1) {
    console.error(
      `\nWARNING: expected exactly 1 user, got ${String(usersAfter)}.`,
    )
    process.exitCode = 1
    return
  }
  console.log(`\ndone.`)
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
