import "../env.ts"
import { eq, isNull } from "drizzle-orm"
import { propertyTable } from "./schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
} from "./schema/users.schema.ts"
import { db, pool } from "./client.ts"

// Backfills user_groups.property_id for groups created before the
// userGroup.create fix, which dropped the property link and saved groups with
// property_id = NULL. Such groups only stayed visible while the calling user
// was a member; once they left, the group fell out of every property view.
//
// Production has a single property ("Furua"), so any group with a NULL
// property_id belongs to it. The script refuses to run if more than one
// property exists, since the "all orphans -> Furua" assumption is only safe
// with a single property.
//
// Usage:
//   pnpm tsx server/src/db/backfill-group-property.ts          # dry-run
//   pnpm tsx server/src/db/backfill-group-property.ts --apply  # writes

const DRY_RUN = !process.argv.includes("--apply")
const PROPERTY_NAME = "Furua"

async function main() {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (pass --apply to write)" : "APPLY"}`)

  const allProperties = await db
    .select({ id: propertyTable.id, name: propertyTable.name })
    .from(propertyTable)

  if (allProperties.length > 1) {
    console.error(
      `\nABORT: found ${String(allProperties.length)} properties; orphaned ` +
        `groups can only be safely attributed when a single property exists. ` +
        `Resolve group->property links manually.`,
    )
    allProperties.forEach(p => console.error(`  #${String(p.id)} ${p.name}`))
    process.exitCode = 1
    return
  }

  const property = allProperties.find(p => p.name === PROPERTY_NAME)
  if (!property) {
    console.error(
      `\nABORT: no property named "${PROPERTY_NAME}" found.` +
        (allProperties.length === 1
          ? ` The only property is "${allProperties[0].name}" (#${String(allProperties[0].id)}).`
          : " The database has no properties."),
    )
    process.exitCode = 1
    return
  }
  console.log(`target property: #${String(property.id)} ${property.name}`)

  const orphans = await db
    .select({ id: userGroupsTable.id, name: userGroupsTable.name })
    .from(userGroupsTable)
    .where(isNull(userGroupsTable.property_id))
    .orderBy(userGroupsTable.id)

  if (orphans.length === 0) {
    console.log("\nnothing to do: no groups with NULL property_id.")
    return
  }

  console.log(`\n${String(orphans.length)} orphaned group(s):`)
  for (const g of orphans) {
    const members = await db
      .select({ user_id: userGroupMembersTable.user_id })
      .from(userGroupMembersTable)
      .where(eq(userGroupMembersTable.user_group_id, g.id))
    console.log(
      `  #${String(g.id)} "${g.name}" — ${String(members.length)} member(s)`,
    )
  }

  if (DRY_RUN) {
    console.log(
      `\nDRY RUN: would set property_id = ${String(property.id)} on ` +
        `${String(orphans.length)} group(s). Re-run with --apply to write.`,
    )
    return
  }

  const updated = await db
    .update(userGroupsTable)
    .set({ property_id: property.id })
    .where(isNull(userGroupsTable.property_id))
    .returning({ id: userGroupsTable.id })

  console.log(`\nupdated ${String(updated.length)} group(s).`)
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
