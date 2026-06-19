import { env } from "../env.ts"
import { eq, inArray, like } from "drizzle-orm"
import { normalizeEmail } from "../auth/email.ts"
import type { SplitPolicyConfig } from "../shared/splitPolicy.ts"
import { normalizeParameters } from "../shared/splitPolicy.ts"
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

// Simple, hand-checkable occupancy: 5 + 3 + 2 = 10 person-days. Ownership is
// deliberately NOT proportional to days (60/20/20 vs 50/30/20) so the custom
// "by ownership %" policy gives a visibly different split from the built-in
// occupancy_days flow. The built-in flow ignores ownership entirely.
const GROUPS = [
  {
    key: "alpha",
    name: "Familie Alpha",
    ownership: "60.00",
    days: 5,
    members: [
      { name: "Anna Alpha", email: `anna${SEED_DOMAIN}` },
      // index 1 is the booking occupant / first non-head member
    ],
  },
  {
    key: "beta",
    name: "Familie Beta",
    ownership: "20.00",
    days: 3,
    members: [
      { name: "Bjørn Beta", email: `bjorn${SEED_DOMAIN}` },
      { name: "Berit Beta", email: `berit${SEED_DOMAIN}` },
    ],
  },
  {
    key: "gamma",
    name: "Familie Gamma",
    ownership: "20.00",
    days: 2,
    members: [
      { name: "Cecilie Gamma", email: `cecilie${SEED_DOMAIN}` },
      { name: "Carl Gamma", email: `carl${SEED_DOMAIN}` },
    ],
  },
] as const

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
  // memberIds[groupKey] = [userId, ...] in declared order.
  const memberIds: Record<string, number[]> = {}
  for (const g of GROUPS) {
    const groupId = (
      await db
        .insert(userGroupsTable)
        .values({ name: g.name, is_family: true, property_id: propertyId })
        .returning({ id: userGroupsTable.id })
    )[0].id

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
  // Each group's occupant is its first *seed* member (index after the head in
  // Alpha), so day-credit lands on the group regardless of who logs in.
  const occupantOf = (key: string): number => {
    const ids = memberIds[key]
    return key === "alpha" ? ids[1] : ids[0]
  }
  let startDay = 1
  for (const g of GROUPS) {
    const occupant = occupantOf(g.key)
    const start = isoDate(7, startDay)
    const end = isoDate(7, startDay + g.days - 1) // inclusive day count = g.days
    const bookingId = (
      await db
        .insert(bookingTable)
        .values({
          property_id: propertyId,
          booker_id: occupant,
          start_date: start,
          end_date: end,
          status: "confirmed",
        })
        .returning({ id: bookingTable.id })
    )[0].id
    await db.insert(bookingOccupantsTable).values({
      booking_id: bookingId,
      user_id: occupant,
    })
    startDay += g.days + 1 // a one-day gap between stays
  }

  // --- expenses ----------------------------------------------------------
  // Two already-reimbursed expenses give an immediate, multi-party "divide"
  // result; reimbursed_by stays within the payer's own group so credit lands
  // on that group (effectivePayer = reimbursed_by ?? payer).
  await db.insert(expensesTable).values([
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Strøm Q1",
      amount: 600,
      payer_id: memberIds.alpha[1], // Anna Alpha
      reimbursed_by_id: memberIds.alpha[0], // admin (Alpha) — must differ from payer
      date: isoDate(2, 10),
      status: "reimbursed",
      expense_types: ["Strøm"],
    },
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Forsikring",
      amount: 400,
      payer_id: memberIds.beta[1], // Berit Beta
      reimbursed_by_id: memberIds.beta[0], // Bjørn Beta
      date: isoDate(3, 1),
      status: "reimbursed",
      expense_types: ["Forsikring"],
    },
    // Two submitted expenses sitting in the review queue for the dev to
    // reimburse/reject during the "reviewing" phase.
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Vedlikehold tak",
      amount: 250,
      payer_id: memberIds.gamma[1], // Carl Gamma
      date: isoDate(5, 12),
      status: "submitted",
      expense_types: ["Vedlikehold"],
    },
    {
      property_id: propertyId,
      settlement_id: settlementId,
      description: "Renhold",
      amount: 150,
      payer_id: memberIds.gamma[0], // Cecilie Gamma
      date: isoDate(6, 3),
      status: "submitted",
      expense_types: ["Renhold"],
    },
  ])

  // --- closed settlement (last year), divided by the custom policy --------
  // A fully closed settlement so its result is visible in the UI immediately
  // (getClosedSummary reads persisted totals/transfers — it does not recompute).
  // We run the real calc here and persist exactly what acceptSplit would.
  let closedSettlementId: number | null = null
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

  // --- summary -----------------------------------------------------------
  console.log("settlement seed complete.")
  console.log(`  property      #${String(propertyId)} "${PROPERTY_NAME}"`)
  console.log(`  settlement    #${String(settlementId)} (${String(YEAR)} summer, occupancy_days, collecting_expenses)`)
  console.log(`  log in as     ${LOGIN_EMAIL}  (admin + sole head of Familie Alpha)`)
  console.log("  occupancy     Alpha 5 + Beta 3 + Gamma 2 = 10 person-days")
  console.log("  reimbursed    Strøm 600 -> Alpha, Forsikring 400 -> Beta (total 1000)")
  console.log("  to review     Vedlikehold 250, Renhold 150 (submitted)")
  console.log("  divide (now)  shares Alpha 500 / Beta 300 / Gamma 200")
  console.log("                net    Alpha +100 / Beta +100 / Gamma -200")
  console.log("                xfers  Gamma->Alpha 100, Gamma->Beta 100")
  console.log("  ownership     Alpha 60% / Beta 20% / Gamma 20%")
  console.log("")
  console.log('  custom policy "Strøm etter eierandel, resten etter døgn"')
  console.log("                Strøm by ownership %, rest by person-days")
  console.log("                edit it in Administrer -> Fordelingspolicy")
  if (closedSettlementId != null) {
    console.log(
      `  closed sett.  #${String(closedSettlementId)} (${String(YEAR - 1)} summer) divided by the custom policy:`,
    )
    console.log("                shares Alpha 560 / Beta 240 / Gamma 200")
    console.log("                net    Alpha +40 / Beta +160 / Gamma -200")
    console.log("                xfers  Gamma->Beta 160, Gamma->Alpha 40 (pending)")
  }
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
