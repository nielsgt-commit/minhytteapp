import { env } from "../env.ts"
import { eq, inArray, like } from "drizzle-orm"
import { normalizeEmail } from "../auth/email.ts"
import type { SplitPolicyConfig } from "../shared/splitPolicy.ts"
import { normalizeParameters } from "../shared/splitPolicy.ts"
import { Temporal } from "../shared/temporal.ts"
import {
  computePolicySplit,
  computeTransfers,
  loadSplitInput,
} from "../services/settlementSplit.ts"
import { db, pool } from "./client.ts"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "./schema/booking.schema.ts"
import { dinnerResponsiblesTable } from "./schema/dinner.schema.ts"
import { eventTable } from "./schema/event.schema.ts"
import {
  equipmentCategoriesTable,
  equipmentTable,
} from "./schema/maintenance.schema.ts"
import {
  infrastructureTable,
  parkingClaimsTable,
  propertyContactsTable,
  propertyOwnersTable,
  propertyPriorityWeeksTable,
  propertySeasonsTable,
  propertyTable,
  structuresTable,
} from "./schema/property.schema.ts"
import { shoppingListItemsTable } from "./schema/shopping.schema.ts"
import { stayTable } from "./schema/stay.schema.ts"
import { todosTable } from "./schema/todo.schema.ts"
import {
  expenseCategoriesTable,
  expenseSharesTable,
  expensesTable,
  propertySplitPoliciesTable,
  settlementAcceptancesTable,
  settlementBookingAdjustmentsTable,
  settlementReviewsTable,
  settlementTransfersTable,
  settlementUserGroupTotalsTable,
  settlementsTable,
} from "./schema/settlement.schema.ts"
import {
  allowedEmailsTable,
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "./schema/users.schema.ts"

// ---------------------------------------------------------------------------
// A self-contained settlement scenario for exercising the full e2e flow by
// hand: add expense -> review -> divide cost. Re-runnable: it tears down the
// previous "Testhytta" (and its seed users) before rebuilding.
//
//   pnpm db:seed:settlement        (or: npx tsx server/src/db/seed-settlement.ts)
//
// Log in as SEED_LOGIN_EMAIL (default niels.theissen@gmail.com). That user is
// made an admin and head of Familie Alpha. Every family has a head (4 heads in
// total), so multi-head gating is real: the other heads must finish their
// review and accept the split before the settlement can close.
// ---------------------------------------------------------------------------

const PROPERTY_NAME = "Testhytta"
const SEED_DOMAIN = "@seed.minhytte.test"
const LOGIN_EMAIL = normalizeEmail(
  process.env.SEED_LOGIN_EMAIL ?? "niels.theissen@gmail.com",
)
const YEAR = new Date().getFullYear()

// SEED_PHASE=split_policy fast-forwards the open settlement to step 4: every
// submitted expense is approved (what the heads would do in review), all four
// heads' reviews are marked done, and the settlement waits at "Review split
// policy" with no acceptances yet. Default: the flow starts from the top.
const FAST_FORWARD = process.env.SEED_PHASE === "split_policy"
const OPEN_PHASE = FAST_FORWARD
  ? ("split_policy" as const)
  : ("collecting_expenses" as const)

// Each family owns the property and books its main stay week; alpha/beta/gamma
// book their priority week (28/29/30, the only weeks allowed by the
// priority_week_peak_only check), delta books outside the peak. On top of the
// main week every family has several shorter stays spread across the year
// (`extraStays`), often with only some members aboard, so person-days vary
// realistically between the households. Children carry the `child` flag so
// child_weight policies have something to scale. Ownership is deliberately NOT
// proportional to person-days so the custom "by ownership %" policy splits
// visibly differently from the built-in occupancy_days flow.
// `head: true` marks the family's head; Alpha's head is the login admin.
type SeedMember = {
  name: string
  email: string
  child?: boolean
  head?: boolean
}
// `who` holds indexes into memberIds[group] (0 = the head; for Alpha that is
// the login admin). Omitted = the whole family stays.
type SeedStay = { week: number; length: number; who?: number[] }
type SeedGroup = {
  key: "alpha" | "beta" | "gamma" | "delta"
  name: string
  ownership: string
  priorityWeek?: 28 | 29 | 30
  stayWeek: number
  stayLength: number
  extraStays: SeedStay[]
  members: SeedMember[]
}
const GROUPS: SeedGroup[] = [
  {
    key: "alpha",
    name: "Familie Alpha",
    ownership: "40.00",
    priorityWeek: 28,
    stayWeek: 28,
    stayLength: 7, // the whole of week 28
    extraStays: [
      { week: 8, length: 4, who: [0, 1] }, // winter, adults only
      { week: 15, length: 5 }, // easter, everyone
      { week: 41, length: 3, who: [0, 1] }, // autumn break
    ],
    members: [
      // The login admin is prepended as the head; these are the rest.
      { name: "Anna Alpha", email: `anna${SEED_DOMAIN}` },
      { name: "Alma Alpha", email: `alma${SEED_DOMAIN}`, child: true },
      { name: "Aksel Alpha", email: `aksel${SEED_DOMAIN}`, child: true },
    ],
  },
  {
    key: "beta",
    name: "Familie Beta",
    ownership: "20.00",
    priorityWeek: 29,
    stayWeek: 29,
    stayLength: 5,
    extraStays: [
      { week: 7, length: 3, who: [0, 1] }, // winter weekend
      { week: 33, length: 4 }, // late summer, everyone
      { week: 46, length: 2, who: [0] }, // head alone, closing chores
    ],
    members: [
      { name: "Bjørn Beta", email: `bjorn${SEED_DOMAIN}`, head: true },
      { name: "Berit Beta", email: `berit${SEED_DOMAIN}` },
      { name: "Bea Beta", email: `bea${SEED_DOMAIN}` },
      { name: "Bo Beta", email: `bo${SEED_DOMAIN}`, child: true },
    ],
  },
  {
    key: "gamma",
    name: "Familie Gamma",
    ownership: "20.00",
    priorityWeek: 30,
    stayWeek: 30,
    stayLength: 3,
    extraStays: [
      { week: 12, length: 2 }, // spring weekend, everyone
      { week: 36, length: 4, who: [0, 1] }, // september, adults only
      { week: 50, length: 3 }, // pre-christmas, everyone
    ],
    members: [
      { name: "Cecilie Gamma", email: `cecilie${SEED_DOMAIN}`, head: true },
      { name: "Carl Gamma", email: `carl${SEED_DOMAIN}` },
      { name: "Cilla Gamma", email: `cilla${SEED_DOMAIN}`, child: true },
    ],
  },
  {
    key: "delta",
    name: "Familie Delta",
    ownership: "20.00",
    // No priority week: only 28-30 pass the peak-only check, and those are
    // taken. Delta stays outside the peak instead.
    stayWeek: 31,
    stayLength: 4,
    extraStays: [
      { week: 5, length: 3 }, // winter, everyone
      { week: 38, length: 2, who: [0, 1] }, // september weekend
      { week: 44, length: 3, who: [1, 2] }, // Dina + Dora, autumn
    ],
    members: [
      { name: "Dag Delta", email: `dag${SEED_DOMAIN}`, head: true },
      { name: "Dina Delta", email: `dina${SEED_DOMAIN}` },
      { name: "Dora Delta", email: `dora${SEED_DOMAIN}`, child: true },
    ],
  },
]

// Monday of an ISO week, as a "YYYY-MM-DD" string. Mirrors isoWeekRange in
// settlementSplit.ts so seeded stays line up with the priority-week windows.
function isoWeekMonday(year: number, week: number): Temporal.PlainDate {
  const jan4 = Temporal.PlainDate.from({ year, month: 1, day: 4 })
  const week1Monday = jan4.subtract({ days: jan4.dayOfWeek - 1 })
  return week1Monday.add({ weeks: week - 1 })
}

const CATEGORIES = ["Strøm", "Forsikring", "Vedlikehold", "Renhold", "Brensel"]

function isoDate(month: number, day: number): string {
  return `${String(YEAR)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// A year's worth of expenses spread across every household and category.
// `submitted` rows land in the heads' review queues (Delta deliberately has
// none, so the four heads' progress states differ); the rest are reimbursed
// and count toward the divide immediately. `payerIdx` points into
// memberIds[group] (0 = the group's head; for Alpha that is the login admin).
// Reimbursement stays within the payer's own group so credit lands on that
// group: the head reimburses, unless the head paid — then the second member
// does.
type SeedExpense = {
  description: string
  amount: number
  category: (typeof CATEGORIES)[number]
  group: SeedGroup["key"]
  payerIdx: number
  date: string
  submitted?: boolean
}
const EXPENSES: SeedExpense[] = [
  // Strøm — bi-monthly bills, rotating payer household.
  {
    description: "Strøm januar",
    amount: 2400,
    category: "Strøm",
    group: "alpha",
    payerIdx: 1,
    date: isoDate(1, 15),
  },
  {
    description: "Strøm mars",
    amount: 1900,
    category: "Strøm",
    group: "beta",
    payerIdx: 1,
    date: isoDate(3, 12),
  },
  {
    description: "Strøm mai",
    amount: 1100,
    category: "Strøm",
    group: "gamma",
    payerIdx: 1,
    date: isoDate(5, 10),
  },
  // Dated inside week 28 (Alpha's stay) for present_when_expense_added policies.
  {
    description: "Strøm sommer",
    amount: 950,
    category: "Strøm",
    group: "alpha",
    payerIdx: 0,
    date: isoWeekMonday(YEAR, 28).add({ days: 2 }).toString(),
  },
  {
    description: "Strøm september",
    amount: 1300,
    category: "Strøm",
    group: "delta",
    payerIdx: 1,
    date: isoDate(9, 15),
  },
  {
    description: "Strøm november",
    amount: 2100,
    category: "Strøm",
    group: "beta",
    payerIdx: 0,
    date: isoDate(11, 12),
  },
  // Forsikring
  {
    description: "Forsikring hytte",
    amount: 8900,
    category: "Forsikring",
    group: "alpha",
    payerIdx: 0,
    date: isoDate(1, 3),
  },
  {
    description: "Forsikring naust",
    amount: 1200,
    category: "Forsikring",
    group: "delta",
    payerIdx: 0,
    date: isoDate(6, 1),
  },
  // Vedlikehold
  {
    description: "Beis og maling",
    amount: 3200,
    category: "Vedlikehold",
    group: "beta",
    payerIdx: 2,
    date: isoDate(4, 18),
  },
  {
    description: "Nye takrenner",
    amount: 4500,
    category: "Vedlikehold",
    group: "alpha",
    payerIdx: 1,
    date: isoDate(5, 4),
  },
  {
    description: "Dørlås og håndtak",
    amount: 780,
    category: "Vedlikehold",
    group: "gamma",
    payerIdx: 0,
    date: isoDate(6, 20),
  },
  {
    description: "Reparasjon av trapp",
    amount: 2600,
    category: "Vedlikehold",
    group: "delta",
    payerIdx: 1,
    date: isoDate(7, 30),
  },
  {
    description: "Ny vindski",
    amount: 1450,
    category: "Vedlikehold",
    group: "beta",
    payerIdx: 1,
    date: isoDate(8, 22),
  },
  // Renhold — after each family's main stay.
  {
    description: "Vårvask",
    amount: 600,
    category: "Renhold",
    group: "alpha",
    payerIdx: 1,
    date: isoDate(5, 18),
  },
  {
    description: "Renhold etter uke 28",
    amount: 450,
    category: "Renhold",
    group: "alpha",
    payerIdx: 0,
    date: isoDate(7, 20),
  },
  {
    description: "Renhold etter uke 29",
    amount: 450,
    category: "Renhold",
    group: "beta",
    payerIdx: 1,
    date: isoDate(7, 27),
  },
  {
    description: "Renhold etter uke 30",
    amount: 350,
    category: "Renhold",
    group: "gamma",
    payerIdx: 1,
    date: isoDate(8, 3),
  },
  {
    description: "Hovedrengjøring høst",
    amount: 800,
    category: "Renhold",
    group: "delta",
    payerIdx: 0,
    date: isoDate(8, 30),
  },
  // Brensel
  {
    description: "Vinterved",
    amount: 1800,
    category: "Brensel",
    group: "delta",
    payerIdx: 1,
    date: isoDate(2, 15),
  },
  {
    description: "Pellets",
    amount: 950,
    category: "Brensel",
    group: "gamma",
    payerIdx: 1,
    date: isoDate(3, 20),
  },
  {
    description: "Høstved",
    amount: 2200,
    category: "Brensel",
    group: "alpha",
    payerIdx: 1,
    date: isoDate(10, 5),
  },
  {
    description: "Propan",
    amount: 700,
    category: "Brensel",
    group: "beta",
    payerIdx: 2,
    date: isoDate(11, 20),
  },
  // Submitted → review queue.
  {
    description: "Renhold etter sesong",
    amount: 400,
    category: "Renhold",
    group: "gamma",
    payerIdx: 1,
    date: isoDate(8, 6),
    submitted: true,
  },
  {
    description: "Strøm tillegg",
    amount: 150,
    category: "Strøm",
    group: "beta",
    payerIdx: 2,
    date: isoDate(8, 9),
    submitted: true,
  },
  // Head-paid, so it lands in the pot automatically once reviewed.
  {
    description: "Vedlikehold rør",
    amount: 250,
    category: "Vedlikehold",
    group: "gamma",
    payerIdx: 0,
    date: isoDate(8, 14),
    submitted: true,
  },
  {
    description: "Renhold vår",
    amount: 200,
    category: "Renhold",
    group: "alpha",
    payerIdx: 1,
    date: isoDate(5, 25),
    submitted: true,
  },
  {
    description: "Ved til høsten",
    amount: 1250,
    category: "Brensel",
    group: "alpha",
    payerIdx: 1,
    date: isoDate(9, 28),
    submitted: true,
  },
  {
    description: "Beis terrasse",
    amount: 890,
    category: "Vedlikehold",
    group: "beta",
    payerIdx: 1,
    date: isoDate(9, 5),
    submitted: true,
  },
]

// This seed writes fake fixture data and must never touch a real database.
// Refuse to run unless the target is an explicitly local Postgres — anything
// production-shaped (NODE_ENV=production, the Render runtime, or a non-loopback
// DB host) aborts before any writes.
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
function assertLocalOnly(): void {
  const host = new URL(env.DATABASE_URL).hostname
  const isLocal = LOCAL_DB_HOSTS.has(host)
  if (env.NODE_ENV === "production" || process.env.RENDER || !isLocal) {
    console.error(
      "[seed:settlement] refusing to run — this seed is local-only.\n" +
        `  NODE_ENV=${env.NODE_ENV}  RENDER=${process.env.RENDER ?? "unset"}  db host=${host}\n` +
        "  It only runs against a local database (localhost / 127.0.0.1).",
    )
    process.exit(1)
  }
}

async function teardown() {
  const existing = await db
    .select({ id: propertyTable.id })
    .from(propertyTable)
    .where(eq(propertyTable.name, PROPERTY_NAME))
  const propertyIds = existing.map(p => p.id)

  if (propertyIds.length > 0) {
    const groups = await db
      .select({ id: userGroupsTable.id })
      .from(userGroupsTable)
      .where(inArray(userGroupsTable.property_id, propertyIds))
    const groupIds = groups.map(g => g.id)

    const settlements = await db
      .select({ id: settlementsTable.id })
      .from(settlementsTable)
      .where(inArray(settlementsTable.property_id, propertyIds))
    const settlementIds = settlements.map(s => s.id)

    const bookings = await db
      .select({ id: bookingTable.id })
      .from(bookingTable)
      .where(inArray(bookingTable.property_id, propertyIds))
    const bookingIds = bookings.map(b => b.id)

    const expenses = await db
      .select({ id: expensesTable.id })
      .from(expensesTable)
      .where(inArray(expensesTable.property_id, propertyIds))
    const expenseIds = expenses.map(e => e.id)

    const delIn = async <T>(
      run: (ids: T[]) => Promise<unknown>,
      ids: T[],
    ): Promise<void> => {
      if (ids.length > 0) await run(ids)
    }

    await delIn(
      ids =>
        db
          .delete(expenseSharesTable)
          .where(inArray(expenseSharesTable.expense_id, ids)),
      expenseIds,
    )
    await delIn(
      ids =>
        db
          .delete(settlementTransfersTable)
          .where(inArray(settlementTransfersTable.settlement_id, ids)),
      settlementIds,
    )
    await delIn(
      ids =>
        db
          .delete(settlementUserGroupTotalsTable)
          .where(inArray(settlementUserGroupTotalsTable.settlement_id, ids)),
      settlementIds,
    )
    await delIn(
      ids =>
        db
          .delete(settlementAcceptancesTable)
          .where(inArray(settlementAcceptancesTable.settlement_id, ids)),
      settlementIds,
    )
    await delIn(
      ids =>
        db
          .delete(settlementReviewsTable)
          .where(inArray(settlementReviewsTable.settlement_id, ids)),
      settlementIds,
    )
    await delIn(
      ids =>
        db
          .delete(settlementBookingAdjustmentsTable)
          .where(inArray(settlementBookingAdjustmentsTable.settlement_id, ids)),
      settlementIds,
    )
    await delIn(
      ids => db.delete(expensesTable).where(inArray(expensesTable.id, ids)),
      expenseIds,
    )
    await delIn(
      ids =>
        db
          .delete(bookingOccupantsTable)
          .where(inArray(bookingOccupantsTable.booking_id, ids)),
      bookingIds,
    )
    await delIn(
      ids =>
        db
          .delete(bookingRoomsTable)
          .where(inArray(bookingRoomsTable.booking_id, ids)),
      bookingIds,
    )
    await delIn(
      ids => db.delete(bookingTable).where(inArray(bookingTable.id, ids)),
      bookingIds,
    )
    // Feature rows created by using the app against the seeded Testhytta
    // (todos, parking, shopping, stays, assets, ...). None of these FKs
    // cascade from properties, so teardown must clear them; their own
    // children DO cascade (assignees, rooms, maintenance/inspections/
    // procedure steps), so one delete per table is enough.
    await db
      .delete(todosTable)
      .where(inArray(todosTable.property_id, propertyIds))
    await db
      .delete(parkingClaimsTable)
      .where(inArray(parkingClaimsTable.property_id, propertyIds))
    await db
      .delete(shoppingListItemsTable)
      .where(inArray(shoppingListItemsTable.property_id, propertyIds))
    await db
      .delete(dinnerResponsiblesTable)
      .where(inArray(dinnerResponsiblesTable.property_id, propertyIds))
    await db
      .delete(eventTable)
      .where(inArray(eventTable.property_id, propertyIds))
    await db
      .delete(stayTable)
      .where(inArray(stayTable.property_id, propertyIds))
    await db
      .delete(propertyContactsTable)
      .where(inArray(propertyContactsTable.property_id, propertyIds))
    await db
      .delete(equipmentTable)
      .where(inArray(equipmentTable.property_id, propertyIds))
    await db
      .delete(equipmentCategoriesTable)
      .where(inArray(equipmentCategoriesTable.property_id, propertyIds))
    await db
      .delete(infrastructureTable)
      .where(inArray(infrastructureTable.property_id, propertyIds))
    await db
      .delete(structuresTable)
      .where(inArray(structuresTable.property_id, propertyIds))
    await delIn(
      ids =>
        db
          .delete(propertyPriorityWeeksTable)
          .where(inArray(propertyPriorityWeeksTable.property_id, ids)),
      propertyIds,
    )
    // After priority weeks: they reference seasons without cascade.
    await db
      .delete(propertySeasonsTable)
      .where(inArray(propertySeasonsTable.property_id, propertyIds))
    await delIn(
      ids =>
        db
          .delete(propertyOwnersTable)
          .where(inArray(propertyOwnersTable.property_id, ids)),
      propertyIds,
    )
    await delIn(
      ids =>
        db
          .delete(propertySplitPoliciesTable)
          .where(inArray(propertySplitPoliciesTable.property_id, ids)),
      propertyIds,
    )
    await delIn(
      ids =>
        db.delete(settlementsTable).where(inArray(settlementsTable.id, ids)),
      settlementIds,
    )
    await delIn(
      ids =>
        db
          .delete(userGroupMembersTable)
          .where(inArray(userGroupMembersTable.user_group_id, ids)),
      groupIds,
    )
    await delIn(
      ids =>
        db
          .delete(allowedEmailsTable)
          .where(inArray(allowedEmailsTable.property_id, ids)),
      propertyIds,
    )
    await delIn(
      ids => db.delete(userGroupsTable).where(inArray(userGroupsTable.id, ids)),
      groupIds,
    )
    await delIn(
      ids =>
        db
          .delete(expenseCategoriesTable)
          .where(inArray(expenseCategoriesTable.property_id, ids)),
      propertyIds,
    )
    await db.delete(propertyTable).where(inArray(propertyTable.id, propertyIds))
  }

  // Drop seed people (never the login admin — its email isn't on SEED_DOMAIN).
  await db
    .delete(allowedEmailsTable)
    .where(like(allowedEmailsTable.email, `%${SEED_DOMAIN}`))
  await db.delete(usersTable).where(like(usersTable.email, `%${SEED_DOMAIN}`))
}

async function main() {
  assertLocalOnly()
  await teardown()

  // --- login admin: sole head of Alpha, can drive the whole flow ----------
  const existingLogin = (
    await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, LOGIN_EMAIL))
      .limit(1)
  ).at(0)
  let loginUserId: number
  if (existingLogin) {
    loginUserId = existingLogin.id
    await db
      .update(usersTable)
      .set({ is_admin: true, email_verified: true, onboarding_step: "done" })
      .where(eq(usersTable.id, loginUserId))
  } else {
    loginUserId = (
      await db
        .insert(usersTable)
        .values({
          name: "Test Head",
          email: LOGIN_EMAIL,
          email_verified: true,
          is_admin: true,
          onboarding_step: "done",
        })
        .returning({ id: usersTable.id })
    )[0].id
  }
  // Allowlist the login email globally so magic-link sign-in is accepted.
  const alreadyAllowed = (
    await db
      .select({ id: allowedEmailsTable.id })
      .from(allowedEmailsTable)
      .where(eq(allowedEmailsTable.email, LOGIN_EMAIL))
      .limit(1)
  ).at(0)
  if (!alreadyAllowed) {
    await db.insert(allowedEmailsTable).values({
      email: LOGIN_EMAIL,
      added_by_user_id: loginUserId,
    })
  }

  // --- property -----------------------------------------------------------
  const propertyId = (
    await db
      .insert(propertyTable)
      .values({
        name: PROPERTY_NAME,
        address: "Hytteveien 1, 0000 Testdal",
        in_family_since: 1998,
        parking_spots: 2,
      })
      .returning({ id: propertyTable.id })
  )[0].id

  // --- expense categories -------------------------------------------------
  const categoryRows = await db
    .insert(expenseCategoriesTable)
    .values(CATEGORIES.map(name => ({ property_id: propertyId, name })))
    .returning({
      id: expenseCategoriesTable.id,
      name: expenseCategoriesTable.name,
    })
  const categoryIdByName = new Map(categoryRows.map(c => [c.name, c.id]))

  // --- groups, members, owners -------------------------------------------
  // memberIds[groupKey] = [userId, ...] in declared order (Alpha's head first).
  const memberIds: Record<string, number[]> = {}
  const groupIdByKey: Record<string, number> = {}
  for (const g of GROUPS) {
    const groupId = (
      await db
        .insert(userGroupsTable)
        .values({ name: g.name, is_family: true, property_id: propertyId })
        .returning({ id: userGroupsTable.id })
    )[0].id
    groupIdByKey[g.key] = groupId

    const ids: number[] = []

    // Alpha's first member is the login admin (the head). Every other member
    // is a plain seed user.
    if (g.key === "alpha") {
      await db.insert(userGroupMembersTable).values({
        user_group_id: groupId,
        user_id: loginUserId,
        is_head: true,
      })
      ids.push(loginUserId)
    }

    for (const m of g.members) {
      const uid = (
        await db
          .insert(usersTable)
          .values({
            name: m.name,
            email: normalizeEmail(m.email),
            email_verified: true,
            is_child: m.child ?? false,
            onboarding_step: "done",
          })
          .returning({ id: usersTable.id })
      )[0].id
      await db.insert(userGroupMembersTable).values({
        user_group_id: groupId,
        user_id: uid,
        is_head: m.head ?? false,
      })
      ids.push(uid)
    }
    memberIds[g.key] = ids

    await db.insert(propertyOwnersTable).values({
      property_id: propertyId,
      user_group_id: groupId,
      ownership_pct: g.ownership,
    })
  }

  // --- priority weeks (peak weeks 28-30; delta has none) ------------------
  await db.insert(propertyPriorityWeeksTable).values(
    GROUPS.flatMap(g =>
      g.priorityWeek == null
        ? []
        : [
            {
              property_id: propertyId,
              user_group_id: groupIdByKey[g.key],
              year: YEAR,
              iso_week: g.priorityWeek,
            },
          ],
    ),
  )

  // --- settlement (built-in occupancy_days flow) -------------------------
  const settlementId = (
    await db
      .insert(settlementsTable)
      .values({
        property_id: propertyId,
        year: YEAR,
        season: "summer",
        status: "open",
        phase: OPEN_PHASE,
        split_policy: "occupancy_days",
        created_by_id: loginUserId,
      })
      .returning({ id: settlementsTable.id })
  )[0].id

  // --- custom split policy (parameterized-builder path) ------------------
  // "Strøm by ownership %, everything else by person-days." A saved policy on
  // the property: open it in the policy builder (Administrer -> Fordelingspolicy)
  // to load/edit it, or point a settlement's split_policy_id at it to divide by
  // it. `parameters` is the minimal set the config exercises (what the builder's
  // deriveParameters would compute on save).
  const stromCategoryId = categoryIdByName.get("Strøm")
  let customPolicyId: number | null = null
  let customConfig: SplitPolicyConfig | null = null
  if (stromCategoryId != null) {
    customConfig = {
      parameters: [
        "expense_categories",
        "participants",
        "booking_days",
        "ownership",
      ],
      rules: [
        {
          what: { kind: "category", category_ids: [stromCategoryId] },
          how: { kind: "by_ownership_pct" },
          who: [{ kind: "main_groups" }],
          except: [],
          when: { kind: "always" },
        },
      ],
      fallback: {
        how: { kind: "weighted_by_occupancy" },
        who: [{ kind: "main_groups" }],
        except: [],
        when: { kind: "always" },
      },
      occupancy: {
        window: { kind: "year" },
        include_extra_guests: false,
        child_weight: 1,
      },
    }
    customPolicyId = (
      await db
        .insert(propertySplitPoliciesTable)
        .values({
          property_id: propertyId,
          name: "Strøm etter eierandel, resten etter døgn",
          config: customConfig,
          created_by_id: loginUserId,
        })
        .returning({ id: propertySplitPoliciesTable.id })
    )[0].id
  }

  // --- bookings + occupants (the person-days that drive the split) -------
  // Each family books its main stay week with everyone aboard (so
  // alpha/beta/gamma members are "present during a priority week" for the
  // time-condition policies), plus its extraStays spread across the year —
  // often with only some members, so the households' person-day totals differ.
  for (const g of GROUPS) {
    const members = memberIds[g.key]
    const stays: SeedStay[] = [
      { week: g.stayWeek, length: g.stayLength },
      ...g.extraStays,
    ]
    for (const s of stays) {
      const occupants = (s.who ?? members.map((_, i) => i)).map(i => members[i])
      const monday = isoWeekMonday(YEAR, s.week)
      const bookingId = (
        await db
          .insert(bookingTable)
          .values({
            property_id: propertyId,
            booker_id: occupants[0],
            start_date: monday.toString(),
            end_date: monday.add({ days: s.length - 1 }).toString(),
            status: "confirmed",
          })
          .returning({ id: bookingTable.id })
      )[0].id
      await db
        .insert(bookingOccupantsTable)
        .values(occupants.map(user_id => ({ booking_id: bookingId, user_id })))
    }
  }

  // --- expenses ----------------------------------------------------------
  // The EXPENSES table above, mapped to rows. Reimbursed ones count toward the
  // divide immediately (credited to the reimburser's group); submitted ones sit
  // in the review queue for the "reviewing" phase. When fast-forwarding past
  // review, the submitted ones are approved instead — status reimbursed with
  // the payer's group head as reimburser — exactly what a head's approval does.
  await db.insert(expensesTable).values(
    EXPENSES.map(e => {
      const members = memberIds[e.group]
      const submitted = (e.submitted ?? false) && !FAST_FORWARD
      return {
        property_id: propertyId,
        settlement_id: settlementId,
        description: e.description,
        amount: e.amount,
        payer_id: members[e.payerIdx],
        reimbursed_by_id: submitted
          ? null
          : e.payerIdx === 0
            ? members[1]
            : members[0],
        date: e.date,
        status: submitted ? ("submitted" as const) : ("reimbursed" as const),
        expense_types: [e.category],
      }
    }),
  )

  // --- fast-forward: all heads' reviews done, waiting at step 4 -----------
  if (FAST_FORWARD) {
    await db.insert(settlementReviewsTable).values(
      GROUPS.map(g => ({
        settlement_id: settlementId,
        head_user_id: memberIds[g.key][0],
      })),
    )
  }

  // --- closed settlement (last year), divided by the custom policy --------
  // A fully closed settlement so its result is visible in the UI immediately
  // (getClosedSummary reads persisted totals/transfers — it does not recompute).
  // We run the real calc here and persist exactly what acceptSplit would.
  let closedSettlementId: number | null = null
  let closedResult: ReturnType<typeof computePolicySplit> | null = null
  let closedTransfers: ReturnType<typeof computeTransfers> | null = null
  if (customPolicyId != null && customConfig != null) {
    const closedYear = YEAR - 1
    closedSettlementId = (
      await db
        .insert(settlementsTable)
        .values({
          property_id: propertyId,
          year: closedYear,
          season: "summer",
          status: "closed",
          phase: "closed",
          split_policy: "occupancy_days", // ignored when split_policy_id is set
          split_policy_id: customPolicyId,
          created_by_id: loginUserId,
          closed_at: new Date(),
        })
        .returning({ id: settlementsTable.id })
    )[0].id
    const closedId = closedSettlementId

    // Same expense shape as the open settlement so the documented custom-policy
    // numbers apply (Strøm 600 -> Alpha, Forsikring 400 -> Beta).
    await db.insert(expensesTable).values([
      {
        property_id: propertyId,
        settlement_id: closedSettlementId,
        description: "Strøm (i fjor)",
        amount: 600,
        payer_id: memberIds.alpha[1],
        reimbursed_by_id: memberIds.alpha[0],
        date: `${String(closedYear)}-02-10`,
        status: "reimbursed",
        expense_types: ["Strøm"],
      },
      {
        property_id: propertyId,
        settlement_id: closedSettlementId,
        description: "Forsikring (i fjor)",
        amount: 400,
        payer_id: memberIds.beta[1],
        reimbursed_by_id: memberIds.beta[0],
        date: `${String(closedYear)}-03-01`,
        status: "reimbursed",
        expense_types: ["Forsikring"],
      },
    ])

    const params = normalizeParameters(customConfig.parameters)
    const input = await loadSplitInput(
      db,
      { id: closedSettlementId, property_id: propertyId, year: closedYear },
      params,
    )
    const result = computePolicySplit(customConfig, input, params)
    const transfers = computeTransfers(result.groups)
    closedResult = result
    closedTransfers = transfers

    if (result.groups.length > 0) {
      await db.insert(settlementUserGroupTotalsTable).values(
        result.groups.map(g => ({
          settlement_id: closedId,
          user_group_id: g.group_id,
          total_paid: g.total_paid,
          total_share: g.total_share,
          net: g.net,
        })),
      )
    }
    if (transfers.length > 0) {
      await db.insert(settlementTransfersTable).values(
        transfers.map(t => ({
          settlement_id: closedId,
          from_user_group_id: t.from_group_id,
          to_user_group_id: t.to_group_id,
          amount: t.amount,
          status: "pending" as const,
        })),
      )
    }
  }

  // --- built-in occupancy divide for the open settlement (for the log) ----
  // Equivalent to the UI's occupancy_days preview: a fallback that splits
  // everything weighted_by_occupancy across the main groups. Computed live so
  // the printed numbers never drift from the seeded data.
  const occupancyConfig: SplitPolicyConfig = {
    parameters: ["booking_days"],
    rules: [],
    fallback: {
      how: { kind: "weighted_by_occupancy" },
      who: [{ kind: "main_groups" }],
      except: [],
      when: { kind: "always" },
    },
    occupancy: {
      window: { kind: "year" },
      include_extra_guests: false,
      child_weight: 1,
    },
  }
  const openParams = normalizeParameters(occupancyConfig.parameters)
  const openInput = await loadSplitInput(
    db,
    { id: settlementId, property_id: propertyId, year: YEAR },
    openParams,
  )
  const openResult = computePolicySplit(occupancyConfig, openInput, openParams)
  const openTransfers = computeTransfers(openResult.groups)

  // --- summary -----------------------------------------------------------
  const short = (name: string) => name.replace("Familie ", "")
  const shareLine = (r: ReturnType<typeof computePolicySplit>) =>
    r.groups
      .map(
        g =>
          `${short(g.group_name)} ${String(g.total_share)} (days ${String(g.booking_days ?? 0)})`,
      )
      .join(" / ")
  const netLine = (r: ReturnType<typeof computePolicySplit>) =>
    r.groups
      .map(
        g => `${short(g.group_name)} ${g.net >= 0 ? "+" : ""}${String(g.net)}`,
      )
      .join(" / ")
  const xferLine = (ts: ReturnType<typeof computeTransfers>) =>
    ts.length === 0
      ? "none"
      : ts
          .map(
            t =>
              `${short(t.from_group_name)}->${short(t.to_group_name)} ${String(t.amount)}`,
          )
          .join(", ")

  const userCount = GROUPS.reduce((n, g) => n + g.members.length, 1) // +1 admin
  const childCount = GROUPS.reduce(
    (n, g) => n + g.members.filter(m => m.child).length,
    0,
  )
  const stayCount = GROUPS.reduce((n, g) => n + 1 + g.extraStays.length, 0)
  const sumAmount = (rows: SeedExpense[]) =>
    rows.reduce((s, e) => s + e.amount, 0)
  const perGroupCounts = (rows: SeedExpense[]) =>
    GROUPS.map(
      g =>
        `${short(g.name)} ${String(rows.filter(e => e.group === g.key).length)}`,
    ).join(" / ")
  const reimbursedSeed = EXPENSES.filter(e => !e.submitted)
  const submittedSeed = EXPENSES.filter(e => e.submitted)

  console.log("settlement seed complete.")
  console.log(`  property      #${String(propertyId)} "${PROPERTY_NAME}"`)
  console.log(`  log in as     ${LOGIN_EMAIL}  (admin + head of Familie Alpha)`)
  console.log(
    `  users         ${String(userCount)} across ${String(GROUPS.length)} owner groups (${String(childCount)} children)`,
  )
  console.log(
    "  heads         4: login (Alpha), Bjørn Beta, Cecilie Gamma, Dag Delta",
  )
  console.log(
    "  priority wks  Alpha=28, Beta=29, Gamma=30 (stays in these weeks; Delta stays week 31)",
  )
  console.log(
    `  bookings      ${String(stayCount)} stays across the year, ${String(openResult.total_booking_days ?? 0)} person-days in total`,
  )
  console.log("")
  console.log(
    `  OPEN sett.    #${String(settlementId)} (${String(YEAR)} summer, occupancy_days, ${OPEN_PHASE})`,
  )
  if (FAST_FORWARD) {
    console.log(
      `    reimbursed  ${String(EXPENSES.length)} expenses / ${String(sumAmount(EXPENSES))} kr (${perGroupCounts(EXPENSES)}) — review queue approved`,
    )
    console.log(
      "    fast-fwd    all 4 heads' reviews done; waiting at step 4 (accept the split)",
    )
  } else {
    console.log(
      `    reimbursed  ${String(reimbursedSeed.length)} expenses / ${String(sumAmount(reimbursedSeed))} kr (${perGroupCounts(reimbursedSeed)})`,
    )
    console.log(
      `    to review   ${String(submittedSeed.length)} expenses / ${String(sumAmount(submittedSeed))} kr (${perGroupCounts(submittedSeed)})`,
    )
  }
  console.log(`    shares      ${shareLine(openResult)}`)
  console.log(`    net         ${netLine(openResult)}`)
  console.log(`    transfers   ${xferLine(openTransfers)}`)
  console.log("")
  console.log('  custom policy "Strøm etter eierandel, resten etter døgn"')
  console.log(
    "    Strøm by ownership % (Alpha 40 / Beta 20 / Gamma 20 / Delta 20), rest by person-days",
  )
  console.log("    edit it in Administrer -> Fordelingspolicy")
  if (
    closedSettlementId != null &&
    closedResult != null &&
    closedTransfers != null
  ) {
    console.log(
      `  CLOSED sett.  #${String(closedSettlementId)} (${String(YEAR - 1)} summer) divided by the custom policy:`,
    )
    console.log(`    shares      ${shareLine(closedResult)}`)
    console.log(`    net         ${netLine(closedResult)}`)
    console.log(`    transfers   ${xferLine(closedTransfers)} (pending)`)
  }
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
