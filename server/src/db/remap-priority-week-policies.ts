import "../env.ts"
import { sql } from "drizzle-orm"
import { db, pool } from "./client.ts"

// Remaps `during_priority_week` split-policy rules from the old property_owner_id to the
// new user_group_id. Task 6 made priority weeks group-keyed, so the split-policy DSL was
// renamed (property_owner_id -> user_group_id); stored configs in
// property_split_policies.config still hold the old property_owner_id numbers.
//
// MUST be run AFTER migration 0068 and BEFORE 0069 — it resolves each property_owner_id
// through property_owners (incl. user_id), which 0069 deletes/drops.
//
// For every policy it walks config.rules[].when and config.fallback.when; for
// kind === "during_priority_week" it maps property_owner_id -> the owner's family group id
// (the group-owner's own group, or a user-owner's is_main group for that property) and
// rewrites the rule to { kind, user_group_id }. Policies whose refs can't be resolved are
// reported and left untouched.
//
// Usage:
//   npm run db:remap-priority-policies              # dry-run report
//   npm run db:remap-priority-policies -- --apply   # write rewritten configs

const DRY_RUN = !process.argv.includes("--apply")

type StoredWhen = {
  kind: string
  property_owner_id?: number
  user_group_id?: number
}
type StoredRule = { when?: StoredWhen }
type StoredConfig = { rules?: StoredRule[]; fallback?: StoredRule }
type PolicyRow = { id: number; name: string; config: StoredConfig }
type OwnerMapRow = { owner_id: number; group_id: number | null }

async function hasUserIdColumn(): Promise<boolean> {
  const r = await db.execute<{ present: boolean }>(sql`
    select exists (
      select 1 from information_schema.columns
      where table_name = 'property_owners' and column_name = 'user_id'
    ) as present`)
  return r.rows[0]?.present ?? false
}

// owner_id -> resolved family group id (null = unresolvable; e.g. orphan user-owner)
async function loadOwnerToGroup(): Promise<Map<number, number | null>> {
  const r = await db.execute<OwnerMapRow>(sql`
    select po.id as owner_id,
           coalesce(po.user_group_id, (
             select g.id from user_group_members m
             join user_groups g on g.id = m.user_group_id
             where m.user_id = po.user_id
               and g.is_main = true
               and g.property_id = po.property_id
             limit 1
           )) as group_id
    from property_owners po`)
  const map = new Map<number, number | null>()
  for (const row of r.rows) map.set(row.owner_id, row.group_id)
  return map
}

function priorityWhens(config: StoredConfig): StoredWhen[] {
  const whens: StoredWhen[] = []
  for (const rule of config.rules ?? []) {
    if (rule.when?.kind === "during_priority_week") whens.push(rule.when)
  }
  if (config.fallback?.when?.kind === "during_priority_week") {
    whens.push(config.fallback.when)
  }
  return whens
}

type Remap = {
  policy: PolicyRow
  config: StoredConfig
  changes: { from: number; to: number }[]
  unresolved: number[]
}

function remapPolicy(
  policy: PolicyRow,
  ownerToGroup: Map<number, number | null>,
): Remap | null {
  const whens = priorityWhens(policy.config)
  if (whens.length === 0) return null

  // deep clone so we mutate a copy, not the row object
  const config = JSON.parse(JSON.stringify(policy.config)) as StoredConfig
  const changes: { from: number; to: number }[] = []
  const unresolved: number[] = []

  for (const when of priorityWhens(config)) {
    const ownerId = when.property_owner_id
    if (ownerId == null) continue // already migrated
    const groupId = ownerToGroup.get(ownerId) ?? null
    if (groupId == null) {
      unresolved.push(ownerId)
      continue
    }
    when.user_group_id = groupId
    delete when.property_owner_id
    changes.push({ from: ownerId, to: groupId })
  }

  return { policy, config, changes, unresolved }
}

async function main() {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (pass --apply to write)" : "APPLY"}`)

  if (!(await hasUserIdColumn())) {
    console.error(
      "\nABORT: property_owners.user_id no longer exists. This script must run " +
        "BEFORE migration 0069 (it resolves property_owner_id through property_owners).",
    )
    process.exitCode = 1
    return
  }

  const ownerToGroup = await loadOwnerToGroup()
  const rows = await db.execute<PolicyRow>(sql`
    select id, name, config from property_split_policies order by id`)

  const remaps = rows.rows
    .map(p => remapPolicy(p, ownerToGroup))
    .filter((r): r is Remap => r !== null)

  const withChanges = remaps.filter(r => r.changes.length > 0)
  const withUnresolved = remaps.filter(r => r.unresolved.length > 0)

  console.log(
    `\n${String(remaps.length)} policy(ies) contain during_priority_week rules; ` +
      `${String(withChanges.length)} need remapping.`,
  )
  for (const r of withChanges) {
    const summary = r.changes
      .map(c => `owner#${String(c.from)}->group#${String(c.to)}`)
      .join(", ")
    console.log(`   policy #${String(r.policy.id)} "${r.policy.name}": ${summary}`)
  }

  if (withUnresolved.length > 0) {
    console.log(`\nUnresolvable refs (left untouched — fix manually):`)
    for (const r of withUnresolved) {
      console.log(
        `   policy #${String(r.policy.id)} "${r.policy.name}": ` +
          `owner ids ${r.unresolved.map(String).join(", ")} have no family group`,
      )
    }
  }

  if (withChanges.length === 0) {
    console.log("\nNothing to remap.")
    return
  }

  if (DRY_RUN) {
    console.log(
      `\nDRY RUN: would rewrite ${String(withChanges.length)} policy config(s). ` +
        `Re-run with --apply to write.`,
    )
    return
  }

  let updated = 0
  for (const r of withChanges) {
    await db.execute(sql`
      update property_split_policies
      set config = ${JSON.stringify(r.config)}::jsonb, updated_at = now()
      where id = ${r.policy.id}`)
    updated++
  }
  console.log(`\nRewrote ${String(updated)} policy config(s).`)
  if (withUnresolved.length > 0) {
    console.log(
      `Note: ${String(withUnresolved.length)} policy(ies) still hold unresolvable refs.`,
    )
  }
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
