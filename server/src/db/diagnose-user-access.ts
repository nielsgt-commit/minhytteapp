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
import { and, asc, eq, isNotNull, sql } from "drizzle-orm"
import { propertyOwnersTable } from "./schema/property.schema.ts"
import {
  allowedEmailsTable,
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "./schema/users.schema.ts"
import { db, pool } from "./client.ts"

const SYNTHETIC_SUFFIXES = ["@oauth.local", "@example.local"]
const isSynthetic = (e: string) =>
  SYNTHETIC_SUFFIXES.some(s => e.trim().toLowerCase().endsWith(s))

const dump = (rows: Record<string, unknown>[]) => {
  for (const r of rows) console.log("  " + JSON.stringify(r))
}

const lowerEmail = (email: string) => eq(sql`lower(${usersTable.email})`, email)

async function main() {
  const raw = process.argv[2]
  if (!raw) {
    console.error("Usage: tsx diagnose-user-access.ts <email>")
    process.exit(1)
  }
  const email = raw.trim().toLowerCase()
  console.log("=== Diagnosing access for: " + email + " ===\n")

  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      onboarding_step: usersTable.onboarding_step,
      is_admin: usersTable.is_admin,
      is_child: usersTable.is_child,
    })
    .from(usersTable)
    .where(lowerEmail(email))
    .orderBy(asc(usersTable.id))
  console.log("[1] users rows: " + String(users.length))
  dump(users)
  for (const u of users) {
    if (isSynthetic(u.email)) {
      console.log(
        "    -> id " +
          String(u.id) +
          " still has a SYNTHETIC email (can't sign in)",
      )
    }
  }
  if (users.length === 0) {
    console.log(
      "    -> no users row: email never persisted, or still a placeholder",
    )
  }

  const allowed = await db
    .select({
      id: allowedEmailsTable.id,
      property_id: allowedEmailsTable.property_id,
      user_group_id: allowedEmailsTable.user_group_id,
      ownership_pct: allowedEmailsTable.ownership_pct,
      used_at: allowedEmailsTable.used_at,
    })
    .from(allowedEmailsTable)
    .where(eq(sql`lower(${allowedEmailsTable.email})`, email))
    .orderBy(asc(allowedEmailsTable.id))
  console.log("\n[allowed_emails] rows: " + String(allowed.length))
  dump(allowed)

  for (const u of users) {
    console.log("\n--- user id " + String(u.id) + " (" + u.email + ") ---")

    const memberships = await db
      .select({
        user_group_id: userGroupMembersTable.user_group_id,
        group_name: userGroupsTable.name,
        is_family: userGroupsTable.is_family,
        property_id: userGroupsTable.property_id,
        is_head: userGroupMembersTable.is_head,
      })
      .from(userGroupMembersTable)
      .innerJoin(
        userGroupsTable,
        eq(userGroupsTable.id, userGroupMembersTable.user_group_id),
      )
      .where(eq(userGroupMembersTable.user_id, u.id))
      .orderBy(asc(userGroupMembersTable.user_group_id))
    if (memberships.length === 0) {
      console.log("  [2] group memberships: NONE -> in no group at all")
    } else {
      console.log("  [2] group memberships:")
      dump(memberships)
    }

    const owners = await db
      .select({
        property_id: propertyOwnersTable.property_id,
        user_group_id: propertyOwnersTable.user_group_id,
        ownership_pct: propertyOwnersTable.ownership_pct,
      })
      .from(propertyOwnersTable)
      .innerJoin(
        userGroupMembersTable,
        eq(
          userGroupMembersTable.user_group_id,
          propertyOwnersTable.user_group_id,
        ),
      )
      .where(eq(userGroupMembersTable.user_id, u.id))
    console.log(
      "  [owners] property_owners via her groups: " + String(owners.length),
    )
    dump(owners)

    // Reconstruct property.mine (server/src/trpc/routers/property.ts).
    const viaOwners = await db
      .selectDistinct({ id: propertyOwnersTable.property_id })
      .from(propertyOwnersTable)
      .innerJoin(
        userGroupMembersTable,
        eq(
          userGroupMembersTable.user_group_id,
          propertyOwnersTable.user_group_id,
        ),
      )
      .where(eq(userGroupMembersTable.user_id, u.id))
    const viaLink = await db
      .selectDistinct({ id: userGroupsTable.property_id })
      .from(userGroupsTable)
      .innerJoin(
        userGroupMembersTable,
        eq(userGroupMembersTable.user_group_id, userGroupsTable.id),
      )
      .where(
        and(
          eq(userGroupMembersTable.user_id, u.id),
          isNotNull(userGroupsTable.property_id),
        ),
      )
    const ids = new Set<number>()
    for (const r of viaOwners) ids.add(r.id)
    for (const r of viaLink) if (r.id != null) ids.add(r.id)
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
