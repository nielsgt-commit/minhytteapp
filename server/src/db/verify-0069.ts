import "../env.ts"
import { sql } from "drizzle-orm"
import { db, pool } from "./client.ts"

// Post-migration verification for 0069 (group-only ownership). Run AFTER applying 0069.
// Hard checks (FAIL -> exit 1) confirm the structural change applied; soft checks (WARN)
// surface data to review. Read-only.
//
// Usage:
//   npm run db:verify-0069

type Status = "PASS" | "FAIL" | "WARN"
const results: { status: Status; msg: string }[] = []
function record(status: Status, msg: string) {
  results.push({ status, msg })
  console.log(`[${status}] ${msg}`)
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await db.execute<{ present: boolean }>(sql`
    select exists (
      select 1 from information_schema.columns
      where table_name = ${table} and column_name = ${column}
    ) as present`)
  return r.rows[0]?.present ?? false
}

async function indexExists(name: string): Promise<boolean> {
  const r = await db.execute<{ present: boolean }>(sql`
    select exists (select 1 from pg_indexes where indexname = ${name}) as present`)
  return r.rows[0]?.present ?? false
}

async function constraintExists(name: string): Promise<boolean> {
  const r = await db.execute<{ present: boolean }>(sql`
    select exists (select 1 from pg_constraint where conname = ${name}) as present`)
  return r.rows[0]?.present ?? false
}

async function countWhere(query: ReturnType<typeof sql>): Promise<number> {
  const r = await db.execute<{ n: number }>(query)
  return r.rows[0]?.n ?? 0
}

async function main() {
  // ---- detect whether 0069 has been applied at all ----
  if (await columnExists("property_owners", "user_id")) {
    console.error(
      "property_owners.user_id still exists — migration 0069 has NOT been applied. " +
        "Run `npm run db:migrate` first, then re-run this check.",
    )
    process.exitCode = 1
    return
  }

  // ===== HARD checks: structural =====
  if (!(await columnExists("property_priority_weeks", "property_owner_id"))) {
    record("PASS", "property_priority_weeks.property_owner_id dropped")
  } else {
    record("FAIL", "property_priority_weeks.property_owner_id still present")
  }

  const groupUq = await indexExists("property_owners_group_uq")
  const userUq = await indexExists("property_owners_user_uq")
  record(
    groupUq && !userUq ? "PASS" : "FAIL",
    `property_owners indexes: group_uq=${String(groupUq)} (want true), user_uq=${String(userUq)} (want false)`,
  )

  const newPwIdx = await indexExists("priority_week_uq_group_year")
  const oldPwIdx = await indexExists("priority_week_uq_owner_year")
  record(
    newPwIdx && !oldPwIdx ? "PASS" : "FAIL",
    `priority week unique index: group_year=${String(newPwIdx)} (want true), owner_year=${String(oldPwIdx)} (want false)`,
  )

  const xorGone = !(await constraintExists("property_owners_exactly_one_ref"))
  record(xorGone ? "PASS" : "FAIL", `property_owners XOR check removed: ${String(xorGone)}`)

  // ===== HARD checks: no NULL group refs (NOT NULL columns) =====
  const nullOwnerGroups = await countWhere(
    sql`select count(*)::int as n from property_owners where user_group_id is null`,
  )
  record(
    nullOwnerGroups === 0 ? "PASS" : "FAIL",
    `property_owners with NULL user_group_id: ${String(nullOwnerGroups)} (want 0)`,
  )

  const nullWeekGroups = await countWhere(
    sql`select count(*)::int as n from property_priority_weeks where user_group_id is null`,
  )
  record(
    nullWeekGroups === 0 ? "PASS" : "FAIL",
    `property_priority_weeks with NULL user_group_id: ${String(nullWeekGroups)} (want 0)`,
  )

  // ===== SOFT checks: data sanity =====
  // per-property ownership totals != 100
  const badTotals = await db.execute<{ property_id: number; total: string }>(sql`
    select property_id, sum(ownership_pct)::text as total
    from property_owners group by property_id having sum(ownership_pct) <> 100
    order by property_id`)
  if (badTotals.rows.length === 0) {
    record("PASS", "every property's ownership_pct sums to 100")
  } else {
    record(
      "WARN",
      `${String(badTotals.rows.length)} property(ies) do NOT sum to 100: ` +
        badTotals.rows.map(r => `#${String(r.property_id)}=${r.total}`).join(", "),
    )
  }

  // duplicate owner rows per (property, group) — should be impossible given group_uq
  const dupOwners = await countWhere(sql`
    select count(*)::int as n from (
      select property_id, user_group_id from property_owners
      group by property_id, user_group_id having count(*) > 1
    ) d`)
  record(
    dupOwners === 0 ? "PASS" : "WARN",
    `duplicate (property, group) owner rows: ${String(dupOwners)} (want 0)`,
  )

  // split policies still carrying property_owner_id in a during_priority_week rule (unresolved remaps)
  const stalePolicies = await db.execute<{ id: number; name: string }>(sql`
    select id, name from property_split_policies p
    where exists (
      select 1 from jsonb_array_elements(coalesce(p.config->'rules', '[]'::jsonb)) r
      where r->'when'->>'kind' = 'during_priority_week' and (r->'when') ? 'property_owner_id'
    )
    or (p.config->'fallback'->'when'->>'kind' = 'during_priority_week'
        and (p.config->'fallback'->'when') ? 'property_owner_id')
    order by id`)
  if (stalePolicies.rows.length === 0) {
    record("PASS", "no split policy still references property_owner_id in during_priority_week")
  } else {
    record(
      "WARN",
      `${String(stalePolicies.rows.length)} split policy(ies) still hold property_owner_id ` +
        `(unresolved remap): ` +
        stalePolicies.rows.map(r => `#${String(r.id)} "${r.name}"`).join(", "),
    )
  }

  // priority weeks pointing at a group that isn't an is_family group of that property
  const oddWeekGroups = await countWhere(sql`
    select count(*)::int as n
    from property_priority_weeks pw
    join user_groups g on g.id = pw.user_group_id
    where g.is_family = false or g.property_id is distinct from pw.property_id`)
  record(
    oddWeekGroups === 0 ? "PASS" : "WARN",
    `priority weeks whose group isn't an is_family group of its property: ${String(oddWeekGroups)} (want 0)`,
  )

  // owner rows whose group isn't an is_family group of that property (informational)
  const nonMainOwners = await countWhere(sql`
    select count(*)::int as n
    from property_owners po
    join user_groups g on g.id = po.user_group_id
    where g.is_family = false or g.property_id is distinct from po.property_id`)
  record(
    nonMainOwners === 0 ? "PASS" : "WARN",
    `owner rows whose group isn't an is_family group of its property: ${String(nonMainOwners)} (info)`,
  )

  const fails = results.filter(r => r.status === "FAIL").length
  const warns = results.filter(r => r.status === "WARN").length
  console.log(
    `\nSummary: ${String(results.filter(r => r.status === "PASS").length)} PASS, ` +
      `${String(warns)} WARN, ${String(fails)} FAIL`,
  )
  if (fails > 0) {
    console.error("\nFAILED: structural verification did not pass.")
    process.exitCode = 1
  } else if (warns > 0) {
    console.log("\nOK structurally; review the WARN items above (data-level).")
  } else {
    console.log("\nAll checks passed.")
  }
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
