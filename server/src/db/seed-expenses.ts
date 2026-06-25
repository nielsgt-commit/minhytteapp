import { env } from "../env.ts"
import { and, eq, inArray, like } from "drizzle-orm"
import { db, pool } from "./client.ts"
import {
  expenseCategoriesTable,
  expenseSharesTable,
  expensesTable,
  settlementsTable,
} from "./schema/settlement.schema.ts"
import { propertyTable } from "./schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "./schema/users.schema.ts"

// ---------------------------------------------------------------------------
// One-time seed: drop a bunch of varied expenses onto the open settlement of
// the "Testhytta" property so the settlement dashboard (top contributors,
// leading categories, preliminary split) has something interesting to show.
//
//   pnpm db:seed:expenses    (or: npx tsx server/src/db/seed-expenses.ts)
//
// Run `pnpm db:seed:settlement` first — this script reuses that property, its
// owner groups and its open settlement. It is re-runnable: every row it writes
// is tagged with a "[bulk]" marker and the previous batch is cleared first, so
// running it twice does not pile up duplicates.
// ---------------------------------------------------------------------------

const PROPERTY_NAME = "Testhytta"
const MARKER = "[bulk]"
const COUNT = 48 // how many expenses to generate

// This seed writes fake fixture data and must never touch a real database.
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
function assertLocalOnly(): void {
  const host = new URL(env.DATABASE_URL).hostname
  const isLocal = LOCAL_DB_HOSTS.has(host)
  if (env.NODE_ENV === "production" || process.env.RENDER || !isLocal) {
    console.error(
      "[seed:expenses] refusing to run — this seed is local-only.\n" +
        `  NODE_ENV=${env.NODE_ENV}  RENDER=${process.env.RENDER ?? "unset"}  db host=${host}\n` +
        "  It only runs against a local database (localhost / 127.0.0.1).",
    )
    process.exit(1)
  }
}

type Member = { user_id: number; name: string; is_head: boolean }
type Group = { id: number; name: string; members: Member[] }

function isoDate(year: number, month: number, day: number): string {
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

async function main() {
  assertLocalOnly()

  // --- locate the seeded property + its open settlement ------------------
  const property = (
    await db
      .select({ id: propertyTable.id })
      .from(propertyTable)
      .where(eq(propertyTable.name, PROPERTY_NAME))
      .limit(1)
  ).at(0)
  if (property == null) {
    console.error(
      `[seed:expenses] no "${PROPERTY_NAME}" property found — run \`pnpm db:seed:settlement\` first.`,
    )
    process.exit(1)
  }
  const propertyId = property.id

  const openSettlement = (
    await db
      .select({ id: settlementsTable.id, phase: settlementsTable.phase })
      .from(settlementsTable)
      .where(
        and(
          eq(settlementsTable.property_id, propertyId),
          eq(settlementsTable.status, "open"),
        ),
      )
      .limit(1)
  ).at(0)
  if (openSettlement == null) {
    console.error(
      "[seed:expenses] no open settlement on the property — run `pnpm db:seed:settlement` first.",
    )
    process.exit(1)
  }
  const settlementId = openSettlement.id

  // --- owner groups + members (payers, and same-group reimbursers) -------
  const memberRows = await db
    .select({
      group_id: userGroupsTable.id,
      group_name: userGroupsTable.name,
      user_id: usersTable.id,
      user_name: usersTable.name,
      is_head: userGroupMembersTable.is_head,
    })
    .from(userGroupsTable)
    .innerJoin(
      userGroupMembersTable,
      eq(userGroupMembersTable.user_group_id, userGroupsTable.id),
    )
    .innerJoin(usersTable, eq(usersTable.id, userGroupMembersTable.user_id))
    .where(
      and(
        eq(userGroupsTable.property_id, propertyId),
        eq(userGroupsTable.is_family, true),
      ),
    )

  const groups = new Map<number, Group>()
  for (const r of memberRows) {
    const g = groups.get(r.group_id) ?? {
      id: r.group_id,
      name: r.group_name,
      members: [],
    }
    g.members.push({
      user_id: r.user_id,
      name: r.user_name,
      is_head: r.is_head,
    })
    groups.set(r.group_id, g)
  }
  const groupList = [...groups.values()].filter(g => g.members.length >= 2)
  if (groupList.length === 0) {
    console.error(
      "[seed:expenses] need at least one owner group with 2+ members to attribute expenses.",
    )
    process.exit(1)
  }

  // --- categories (use the property's own; fall back to bare names) -------
  const categoryRows = await db
    .select({ name: expenseCategoriesTable.name })
    .from(expenseCategoriesTable)
    .where(eq(expenseCategoriesTable.property_id, propertyId))
  const categories =
    categoryRows.length > 0
      ? categoryRows.map(c => c.name)
      : ["Strøm", "Forsikring", "Vedlikehold", "Renhold", "Brensel"]

  // --- clear the previous bulk batch (re-runnable) -----------------------
  const oldIds = (
    await db
      .select({ id: expensesTable.id })
      .from(expensesTable)
      .where(
        and(
          eq(expensesTable.property_id, propertyId),
          like(expensesTable.description, `${MARKER}%`),
        ),
      )
  ).map(e => e.id)
  if (oldIds.length > 0) {
    await db
      .delete(expenseSharesTable)
      .where(inArray(expenseSharesTable.expense_id, oldIds))
    await db.delete(expensesTable).where(inArray(expensesTable.id, oldIds))
  }

  // --- flatten payers, weighted so contributor counts come out uneven ----
  // Repeating a member in this list makes them log more expenses, giving the
  // "top contributors" panel a clear ranking instead of a flat tie.
  const payers: { member: Member; group: Group }[] = []
  groupList.forEach((g, gi) => {
    g.members.forEach((m, mi) => {
      // Weight: earlier groups and earlier (head-ish) members log more.
      const weight = Math.max(1, 4 - gi - Math.floor(mi / 2))
      for (let w = 0; w < weight; w++) payers.push({ member: m, group: g })
    })
  })

  const reimburserFor = (group: Group, payerId: number): Member =>
    group.members.find(m => m.is_head && m.user_id !== payerId) ??
    group.members.find(m => m.user_id !== payerId) ??
    group.members[0]

  // --- generate the batch (deterministic, no RNG so re-runs are stable) ---
  const year = new Date().getFullYear()
  const amounts = [120, 240, 380, 540, 760, 990, 1340, 1820, 2450, 3100]
  const rows: (typeof expensesTable.$inferInsert)[] = []
  for (let i = 0; i < COUNT; i++) {
    const { member, group } = payers[i % payers.length]
    const category = categories[i % categories.length]
    // Every 7th expense carries a second category; every 11th is uncategorized.
    const expense_types =
      i % 11 === 0
        ? []
        : i % 7 === 0
          ? [category, categories[(i + 2) % categories.length]]
          : [category]
    const amount = amounts[(i * 3) % amounts.length] + (i % 5) * 25
    const month = 1 + (i % 9) // Jan..Sep
    const day = 1 + ((i * 5) % 27)
    // ~1 in 3 reimbursed (counts toward the split now); rest awaits review.
    const reimbursed = i % 3 === 0
    const label = expense_types[0] ?? "Diverse"
    const base: typeof expensesTable.$inferInsert = {
      property_id: propertyId,
      settlement_id: settlementId,
      description: `${MARKER} ${label} #${String(i + 1)}`,
      amount,
      payer_id: member.user_id,
      date: isoDate(year, month, day),
      status: reimbursed ? "reimbursed" : "submitted",
      expense_types,
    }
    if (reimbursed) {
      base.reimbursed_by_id = reimburserFor(group, member.user_id).user_id
    }
    rows.push(base)
  }

  await db.insert(expensesTable).values(rows)

  // --- summary -----------------------------------------------------------
  const byPayer = new Map<number, { name: string; count: number }>()
  for (let i = 0; i < COUNT; i++) {
    const { member } = payers[i % payers.length]
    const e = byPayer.get(member.user_id) ?? { name: member.name, count: 0 }
    e.count += 1
    byPayer.set(member.user_id, e)
  }
  const top = [...byPayer.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(p => `${p.name} (${String(p.count)})`)
    .join(", ")
  const reimbursedCount = rows.filter(r => r.status === "reimbursed").length

  console.log("expense seed complete.")
  console.log(`  property      #${String(propertyId)} "${PROPERTY_NAME}"`)
  console.log(
    `  settlement    #${String(settlementId)} (${openSettlement.phase})`,
  )
  console.log(
    `  added         ${String(COUNT)} expenses (${String(reimbursedCount)} reimbursed, ${String(COUNT - reimbursedCount)} submitted)`,
  )
  console.log(`  categories    ${categories.join(", ")}`)
  console.log(`  top payers    ${top}`)
  console.log(
    `  re-run safe   all tagged "${MARKER}"; previous batch cleared first`,
  )
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
