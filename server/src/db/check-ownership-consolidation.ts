import "../env.ts"
import { sql } from "drizzle-orm"
import { db, pool } from "./client.ts"

// Pre-flight (and optional fix) for migration 0069, which makes property ownership
// group-only: it folds each per-user owner row into the user's family (is_family) group
// by SUMMING ownership_pct, then drops property_owners.user_id.
//
// MUST be run AFTER migration 0068 and BEFORE 0069 — it reads property_owners.user_id,
// which 0069 removes.
//
// Checks:
//   1. Orphan user-owners — a user-owner row whose user has no is_family (family) group
//      for that property. 0069 would DELETE these rows and their ownership_pct would be
//      lost. --apply creates an is_family family group (the user as head) so the pct folds
//      in during 0069.
//   2. Users in 2+ is_family groups for one property — 0069's SUM would double-count.
//      Reported only; must be resolved manually. --apply aborts if any exist.
//   3. Projected per-property ownership_pct totals after consolidation (warns if != 100).
//
// Usage:
//   npm run db:check-ownership              # dry-run report
//   npm run db:check-ownership -- --apply   # create family groups for orphan owners

const DRY_RUN = !process.argv.includes("--apply")

type OrphanRow = {
  owner_id: number
  property_id: number
  user_id: number
  user_name: string
  ownership_pct: string
}
type DoubleMainRow = {
  user_id: number
  user_name: string
  property_id: number
  group_count: number
}
type PctRow = { property_id: number; total: string }

async function hasUserIdColumn(): Promise<boolean> {
  const r = await db.execute<{ present: boolean }>(sql`
    select exists (
      select 1 from information_schema.columns
      where table_name = 'property_owners' and column_name = 'user_id'
    ) as present`)
  return r.rows[0]?.present ?? false
}

async function findOrphans(): Promise<OrphanRow[]> {
  const r = await db.execute<OrphanRow>(sql`
    select po.id as owner_id, po.property_id, po.user_id,
           u.name as user_name, po.ownership_pct
    from property_owners po
    join users u on u.id = po.user_id
    where po.user_id is not null
      and not exists (
        select 1 from user_group_members gm
        join user_groups g on g.id = gm.user_group_id
        where gm.user_id = po.user_id
          and g.is_family = true
          and g.property_id = po.property_id)
    order by po.property_id, u.name`)
  return r.rows
}

async function findDoubleMains(): Promise<DoubleMainRow[]> {
  const r = await db.execute<DoubleMainRow>(sql`
    select gm.user_id, u.name as user_name, g.property_id,
           count(*)::int as group_count
    from user_group_members gm
    join user_groups g on g.id = gm.user_group_id
    join users u on u.id = gm.user_id
    where g.is_family = true and g.property_id is not null
    group by gm.user_id, u.name, g.property_id
    having count(*) > 1
    order by g.property_id, u.name`)
  return r.rows
}

// Consolidation merges user rows into group rows by SUMMING, so the per-property
// total is unchanged from the current sum of ALL owner rows (provided orphans are
// fixed first and no user sits in 2+ main groups).
async function projectedTotals(): Promise<PctRow[]> {
  const r = await db.execute<PctRow>(sql`
    select property_id, sum(ownership_pct)::text as total
    from property_owners
    group by property_id
    order by property_id`)
  return r.rows
}

async function createFamilyGroup(orphan: OrphanRow): Promise<number> {
  return db.transaction(async tx => {
    const inserted = await tx.execute<{ id: number }>(sql`
      insert into user_groups (name, is_family, property_id)
      values (${orphan.user_name}, true, ${orphan.property_id})
      returning id`)
    const groupId = inserted.rows[0].id
    await tx.execute(sql`
      insert into user_group_members (user_group_id, user_id, is_head)
      values (${groupId}, ${orphan.user_id}, true)
      on conflict do nothing`)
    return groupId
  })
}

async function main() {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (pass --apply to write)" : "APPLY"}`)

  if (!(await hasUserIdColumn())) {
    console.error(
      "\nABORT: property_owners.user_id no longer exists. This script must run " +
        "BEFORE migration 0069 (the group-only ownership migration).",
    )
    process.exitCode = 1
    return
  }

  const orphans = await findOrphans()
  const doubleMains = await findDoubleMains()
  const totals = await projectedTotals()

  console.log(`\n1) Orphan user-owners (no family group for the property): ${String(orphans.length)}`)
  for (const o of orphans) {
    console.log(
      `   owner#${String(o.owner_id)} property ${String(o.property_id)} ` +
        `user ${o.user_name} (#${String(o.user_id)}) — ${o.ownership_pct}%`,
    )
  }

  console.log(`\n2) Users in 2+ is_family groups for one property: ${String(doubleMains.length)}`)
  for (const d of doubleMains) {
    console.log(
      `   ${d.user_name} (#${String(d.user_id)}) on property ${String(d.property_id)}: ` +
        `${String(d.group_count)} main groups`,
    )
  }

  console.log(`\n3) Projected per-property ownership_pct totals after consolidation:`)
  for (const t of totals) {
    const flag = Number(t.total) === 100 ? "" : "  <-- not 100"
    console.log(`   property ${String(t.property_id)}: ${t.total}%${flag}`)
  }

  if (doubleMains.length > 0) {
    console.error(
      `\nABORT: ${String(doubleMains.length)} user(s) belong to multiple is_family groups ` +
        `for the same property; 0069 would double-count their share. Resolve these ` +
        `manually before applying.`,
    )
    process.exitCode = 1
    return
  }

  if (orphans.length === 0) {
    console.log("\nNo orphan owners — ownership is ready for migration 0069.")
    return
  }

  if (DRY_RUN) {
    console.log(
      `\nDRY RUN: would create ${String(orphans.length)} family group(s) (named after ` +
        `each user; rename later if desired). Re-run with --apply to write.`,
    )
    return
  }

  let created = 0
  for (const o of orphans) {
    const groupId = await createFamilyGroup(o)
    created++
    console.log(
      `   created is_family group "${o.user_name}" (#${String(groupId)}) ` +
        `for property ${String(o.property_id)}; user set as head`,
    )
  }
  console.log(`\nCreated ${String(created)} family group(s). Re-run (dry) to confirm 0 orphans.`)
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
