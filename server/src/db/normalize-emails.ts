import "../env.ts"
import { sql } from "drizzle-orm"
import { db, pool } from "./client.ts"

// Lowercases all users.email and allowed_emails.email rows that aren't already
// lower-cased. Aborts with a printout if duplicates exist after normalization,
// since those require manual reassignment of FK rows.
//
// Usage:
//   pnpm tsx server/src/db/normalize-emails.ts          # dry-run, prints what would change
//   pnpm tsx server/src/db/normalize-emails.ts --apply  # actually writes
//
// A separate --apply step is required because a stray collision can otherwise
// trigger the deploy-2 unique(lower(email)) index to fail mid-migration.

const DRY_RUN = !process.argv.includes("--apply")

type MixedRow = { id: number; email: string }
type CollisionRow = { lower: string; count: number }

async function findMixedCase(table: "users" | "allowed_emails") {
  const rows = await db.execute<MixedRow>(
    sql`select id, email from ${sql.identifier(table)} where email <> lower(email) order by id`,
  )
  return rows.rows
}

async function findCollisions(table: "users" | "allowed_emails") {
  const rows = await db.execute<CollisionRow>(
    sql`select lower(email) as lower, count(*)::int as count
        from ${sql.identifier(table)}
        group by lower(email)
        having count(*) > 1
        order by lower(email)`,
  )
  return rows.rows
}

async function applyLowercase(table: "users" | "allowed_emails") {
  const result = await db.execute(
    sql`update ${sql.identifier(table)} set email = lower(email) where email <> lower(email)`,
  )
  return result.rowCount ?? 0
}

async function main() {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (pass --apply to write)" : "APPLY"}`)

  const tables = ["users", "allowed_emails"] as const

  let totalMixed = 0
  let totalCollisions = 0

  for (const table of tables) {
    const mixed = await findMixedCase(table)
    totalMixed += mixed.length
    console.log(
      `\n${table}: ${String(mixed.length)} row(s) with non-lowercase email`,
    )
    for (const r of mixed) {
      console.log(`  #${String(r.id)} ${r.email} -> ${r.email.toLowerCase()}`)
    }

    const collisions = await findCollisions(table)
    totalCollisions += collisions.length
    if (collisions.length > 0) {
      console.log(
        `${table}: ${String(collisions.length)} collision(s) on lower(email):`,
      )
      for (const c of collisions) {
        console.log(`  ${c.lower} -> ${String(c.count)} rows`)
      }
    }
  }

  if (totalCollisions > 0) {
    console.error(
      `\nABORT: ${String(totalCollisions)} duplicate group(s) on lower(email). ` +
        `Resolve manually (reassign FK refs, then delete extras) before re-running.`,
    )
    process.exitCode = 1
    return
  }

  if (totalMixed === 0) {
    console.log("\nnothing to do.")
    return
  }

  if (DRY_RUN) {
    console.log(
      `\nDRY RUN: would update ${String(totalMixed)} row(s). Re-run with --apply to write.`,
    )
    return
  }

  let totalUpdated = 0
  for (const table of tables) {
    const updated = await applyLowercase(table)
    console.log(`${table}: updated ${String(updated)} row(s)`)
    totalUpdated += updated
  }
  console.log(`\nupdated ${String(totalUpdated)} row(s) total.`)
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
