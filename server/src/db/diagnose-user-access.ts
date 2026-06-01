// Read-only diagnostic: why can a given user (by email) not see a property?
// Checks the three things that gate visibility:
//   1. their users row (does the real email actually live on it, or is it
//      still a synthetic placeholder?)
//   2. their group memberships + each group's property_id link
//   3. property_owners rows for those groups
// plus allowed_emails rows, and a reconstruction of what property.mine returns.
//
// Does NOT import ../env.ts on purpose — that runs full prod-secret validation
// (BETTER_AUTH_SECRET, RESEND_API_KEY, ...) a read-only query doesn't need.
// client.ts only reads process.env.DATABASE_URL.
//
// Usage:
//   DATABASE_URL=<url> npx tsx server/src/db/diagnose-user-access.ts her@email.com
import { sql } from "drizzle-orm"
import { db, pool } from "./client.ts"

const SYNTHETIC_SUFFIXES = ["@oauth.local", "@example.local"]
const isSynthetic = (e: string) =>
  SYNTHETIC_SUFFIXES.some(s => e.trim().toLowerCase().endsWith(s))

const dump = (rows: Record<string, unknown>[]) => {
  for (const r of rows) console.log("  " + JSON.stringify(r))
}

async function main() {
  const raw = process.argv[2]
  if (!raw) {
    console.error("Usage: tsx diagnose-user-access.ts <email>")
    process.exit(1)
  }
  const email = raw.trim().toLowerCase()
  console.log("=== Diagnosing access for: " + email + " ===\n")

  const users = await db.execute<{
    id: number
    name: string
    email: string
    onboarding_step: string | null
  }>(sql`
    select id, name, email, onboarding_step, is_admin, is_child
    from users where lower(email) = ${email} order by id
  `)
  console.log("[1] users rows: " + String(users.rows.length))
  dump(users.rows)
  for (const u of users.rows) {
    if (isSynthetic(u.email)) {
      console.log(
        "    -> id " +
          String(u.id) +
          " still has a SYNTHETIC email (can't sign in)",
      )
    }
  }
  if (users.rows.length === 0) {
    console.log(
      "    -> no users row: email never persisted, or still a placeholder",
    )
  }

  const allowed = await db.execute(sql`
    select id, email, property_id, user_group_id, ownership_pct, used_at
    from allowed_emails where lower(email) = ${email} order by id
  `)
  console.log("\n[allowed_emails] rows: " + String(allowed.rows.length))
  dump(allowed.rows)

  for (const u of users.rows) {
    console.log("\n--- user id " + String(u.id) + " (" + u.email + ") ---")

    const memberships = await db.execute(sql`
      select m.user_group_id, g.name as group_name, g.is_family,
             g.property_id, m.is_head
      from user_group_members m join user_groups g on g.id = m.user_group_id
      where m.user_id = ${u.id} order by m.user_group_id
    `)
    if (memberships.rows.length === 0) {
      console.log("  [2] group memberships: NONE -> in no group at all")
    } else {
      console.log("  [2] group memberships:")
      dump(memberships.rows)
    }

    const owners = await db.execute(sql`
      select po.property_id, po.user_group_id, po.ownership_pct
      from property_owners po
      join user_group_members m on m.user_group_id = po.user_group_id
      where m.user_id = ${u.id}
    `)
    console.log(
      "  [owners] property_owners via her groups: " +
        String(owners.rows.length),
    )
    dump(owners.rows)

    const viaOwners = await db.execute<{ id: number }>(sql`
      select distinct po.property_id as id from property_owners po
      join user_group_members m on m.user_group_id = po.user_group_id
      where m.user_id = ${u.id}
    `)
    const viaLink = await db.execute<{ id: number | null }>(sql`
      select distinct g.property_id as id from user_groups g
      join user_group_members m on m.user_group_id = g.id
      where m.user_id = ${u.id} and g.property_id is not null
    `)
    const ids = new Set<number>()
    for (const r of viaOwners.rows) ids.add(r.id)
    for (const r of viaLink.rows) if (r.id != null) ids.add(r.id)
    console.log(
      "  [3] property.mine would return: " +
        (ids.size === 0
          ? "[] (SEES NOTHING)"
          : "[" + [...ids].join(", ") + "]"),
    )
  }
}

main()
  .then(() => pool.end())
  .catch(async (e: unknown) => {
    console.error(e)
    await pool.end()
    process.exit(1)
  })
