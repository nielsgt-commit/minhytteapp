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
import {
  propertyOwnersTable,
  propertyPriorityWeeksTable,
  propertyTable,
} from "./schema/property.schema.ts"
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
// made an admin and the sole *head* of Familie Alpha, so they can drive every
// phase and close the settlement on their own.
// ---------------------------------------------------------------------------

const PROPERTY_NAME = "Testhytta"
const SEED_DOMAIN = "@seed.minhytte.test"
const LOGIN_EMAIL = normalizeEmail(
  process.env.SEED_LOGIN_EMAIL ?? "niels.theissen@gmail.com",
)
const YEAR = new Date().getFullYear()

// Each family owns the property and books its own priority week (28/29/30, the
// only weeks allowed by the priority_week_peak_only check). Children carry the
// `child` flag so child_weight policies have something to scale. Ownership is
// deliberately NOT proportional to person-days so the custom "by ownership %"
// policy splits visibly differently from the built-in occupancy_days flow.
// Person-days = (members who book) * stayLength, child_weight = 1 in built-in.
type SeedMember = { name: string; email: string; child?: boolean }
type SeedGroup = {
  key: "alpha" | "beta" | "gamma"
  name: string
  ownership: string
  priorityWeek: 28 | 29 | 30
  stayLength: number
  members: SeedMember[]
}
const GROUPS: SeedGroup[] = [
  {
    key: "alpha",
    name: "Familie Alpha",
    ownership: "60.00",
    priorityWeek: 28,
    stayLength: 7, // the whole of week 28
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
    stayLength: 5,
    members: [
      { name: "Bjørn Beta", email: `bjorn${SEED_DOMAIN}` },
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
    stayLength: 3,
    members: [
      { name: "Cecilie Gamma", email: `cecilie${SEED_DOMAIN}` },
      { name: "Carl Gamma", email: `carl${SEED_DOMAIN}` },
      { name: "Cilla Gamma", email: `cilla${SEED_DOMAIN}`, child: true },
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
        db.delete(expenseSharesTable).where(
          inArray(expenseSharesTable.expense_id, ids),
        ),
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
        db.delete(bookingRoomsTable).where(inArray(bookingRoomsTable.booking_id, ids)),
      bookingIds,
    )
    await delIn(
      ids => db.delete(bookingTable).where(inArray(bookingTable.id, ids)),
      bookingIds,
    )
    await delIn(
      ids =>
        db
          .delete(propertyPriorityWeeksTable)
          .where(inArray(propertyPriorityWeeksTable.property_id, ids)),
      propertyIds,
    )
    await delIn(
      ids =>
        db.delete(propertyOwnersTable).where(inArray(propertyOwnersTable.property_id, ids)),
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
      ids => db.delete(settlementsTable).where(inArray(settlementsTable.id, ids)),
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
        db.delete(allowedEmailsTable).where(inArray(allowedEmailsTable.property_id, ids)),
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
    .returning({ id: expenseCategoriesTable.id, name: expenseCategoriesTable.name })
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
        is_head: false,
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

  // --- priority weeks (peak weeks 28-30, one per owner group) ------------
  await db.insert(propertyPriorityWeeksTable).values(
    GROUPS.map(g => ({
      property_id: propertyId,
      user_group_id: groupIdByKey[g.key],
      year: YEAR,
      iso_week: g.priorityWeek,
    })),
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
        phase: "collecting_expenses",
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
      parameters: ["expense_categories", "participants", "booking_days", "ownership"],
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
  // Each family stays its whole priority week with all its members aboard, so
  // person-days = members * stayLength and every member is "present during a
  // priority week" for the time-condition policies.
  for (const g of GROUPS) {
    const occupants = memberIds[g.key]
    const monday = isoWeekMonday(YEAR, g.priorityWeek)
    const start = monday.toString()
    const end = monday.add({ days: g.stayLength - 1 }).toString()
    const bookingId = (
      await db
        .insert(bookingTable)
        .values({
          property_id: propertyId,
          booker_id: occupants[0],
          start_date: start,
          end_date: end,
          status: "confirmed",
        })
        .returning({ id: bookingTable.id })
    )[0].id
    await db.insert(bookingOccupantsTable).values(
      occupants.map(user_id => ({ booking_id: bookingId, user_id })),
    )
  }

  // --- expenses ----------------------------------------------------------
  // A bunch of expenses across categories. Reimbursed ones count toward the
  // divide immediately (credited to the reimburser's group); submitted ones sit
  // in the review queue for the "reviewing" phase. reimbursed_by stays within
  // the payer's own group so credit lands on that group.
  const week28Day = isoWeekMonday(YEAR, 28).add({ days: 2 }).toString()
  await db.insert(expensesTable).values([
    // Reimbursed → counted now.
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Strøm sommer",
      amount: 800,
      payer_id: memberIds.alpha[1], // Anna Alpha
      reimbursed_by_id: memberIds.alpha[0], // admin (Alpha)
      date: week28Day, // inside week 28 (Alpha's stay)
      status: "reimbursed",
      expense_types: ["Strøm"],
    },
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Vedlikehold tak",
      amount: 1200,
      payer_id: memberIds.alpha[0], // admin (Alpha)
      reimbursed_by_id: memberIds.alpha[1], // Anna Alpha
      date: isoDate(5, 4),
      status: "reimbursed",
      expense_types: ["Vedlikehold"],
    },
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Forsikring",
      amount: 500,
      payer_id: memberIds.beta[1], // Berit Beta
      reimbursed_by_id: memberIds.beta[0], // Bjørn Beta
      date: isoDate(3, 1),
      status: "reimbursed",
      expense_types: ["Forsikring"],
    },
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Brensel",
      amount: 300,
      payer_id: memberIds.gamma[1], // Carl Gamma
      reimbursed_by_id: memberIds.gamma[0], // Cecilie Gamma
      date: isoDate(4, 20),
      status: "reimbursed",
      expense_types: ["Brensel"],
    },
    // Submitted → review queue.
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Renhold etter sesong",
      amount: 400,
      payer_id: memberIds.gamma[1], // Carl Gamma
      date: isoDate(8, 6),
      status: "submitted",
      expense_types: ["Renhold"],
    },
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Strøm tillegg",
      amount: 150,
      payer_id: memberIds.beta[2], // Bea Beta
      date: isoDate(8, 9),
      status: "submitted",
      expense_types: ["Strøm"],
    },
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Vedlikehold rør",
      amount: 250,
      payer_id: memberIds.gamma[0], // Cecilie Gamma
      date: isoDate(8, 14),
      status: "submitted",
      expense_types: ["Vedlikehold"],
    },
  ])

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
          settlement_id: closedSettlementId as number,
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
          settlement_id: closedSettlementId as number,
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
    occupancy: { window: { kind: "year" }, include_extra_guests: false, child_weight: 1 },
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
      .map(g => `${short(g.group_name)} ${g.total_share} (days ${g.booking_days ?? 0})`)
      .join(" / ")
  const netLine = (r: ReturnType<typeof computePolicySplit>) =>
    r.groups
      .map(g => `${short(g.group_name)} ${g.net >= 0 ? "+" : ""}${g.net}`)
      .join(" / ")
  const xferLine = (ts: ReturnType<typeof computeTransfers>) =>
    ts.length === 0
      ? "none"
      : ts.map(t => `${short(t.from_group_name)}->${short(t.to_group_name)} ${t.amount}`).join(", ")

  const userCount = GROUPS.reduce((n, g) => n + g.members.length, 1) // +1 admin
  const childCount = GROUPS.reduce(
    (n, g) => n + g.members.filter(m => m.child).length,
    0,
  )

  console.log("settlement seed complete.")
  console.log(`  property      #${String(propertyId)} "${PROPERTY_NAME}"`)
  console.log(`  log in as     ${LOGIN_EMAIL}  (admin + sole head of Familie Alpha)`)
  console.log(
    `  users         ${String(userCount)} across 3 owner groups (${String(childCount)} children)`,
  )
  console.log("  priority wks  Alpha=28, Beta=29, Gamma=30 (stays land in these weeks)")
  console.log(`  total days    ${String(openResult.total_booking_days ?? 0)} person-days`)
  console.log("")
  console.log(`  OPEN sett.    #${String(settlementId)} (${String(YEAR)} summer, occupancy_days, collecting_expenses)`)
  console.log("    reimbursed  Strøm 800 + Vedlikehold 1200 -> Alpha, Forsikring 500 -> Beta, Brensel 300 -> Gamma")
  console.log("    to review   Renhold 400, Strøm 150, Vedlikehold 250 (submitted)")
  console.log(`    shares      ${shareLine(openResult)}`)
  console.log(`    net         ${netLine(openResult)}`)
  console.log(`    transfers   ${xferLine(openTransfers)}`)
  console.log("")
  console.log('  custom policy "Strøm etter eierandel, resten etter døgn"')
  console.log("    Strøm by ownership % (Alpha 60 / Beta 20 / Gamma 20), rest by person-days")
  console.log("    edit it in Administrer -> Fordelingspolicy")
  if (closedSettlementId != null && closedResult != null && closedTransfers != null) {
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
