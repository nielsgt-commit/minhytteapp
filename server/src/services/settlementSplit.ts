import { and, eq, inArray, or } from "drizzle-orm"
import type { db as dbClient } from "../db/client.ts"
import {
  bookingOccupantsTable,
  bookingTable,
} from "../db/schema/booking.schema.ts"
import {
  propertyOwnersTable,
  propertyPriorityWeeksTable,
} from "../db/schema/property.schema.ts"
import {
  expenseCategoriesTable,
  expensesTable,
  settlementBookingAdjustmentsTable,
} from "../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../db/schema/users.schema.ts"
import { Temporal, plainDateFromDb } from "../shared/temporal.ts"
import { normalizeWhat, resolveOccupancy } from "../shared/splitPolicy.ts"
import type {
  SplitPolicyConfig,
  SplitPolicyFallback,
  SplitPolicyOccupancyWindow,
  SplitPolicyParameter,
  SplitPolicyRule,
  SplitPolicyWhat,
  SplitPolicyWho,
} from "../shared/splitPolicy.ts"

type Db = typeof dbClient

export type GroupAllocation = {
  group_id: number
  group_name: string
  booking_days: number | null
  total_paid: number
  total_share: number
  net: number
}

export type Transfer = {
  from_group_id: number
  from_group_name: string
  to_group_id: number
  to_group_name: string
  amount: number
}

export function inclusiveDayCount(start: string, end: string): number {
  return plainDateFromDb(start).until(plainDateFromDb(end)).days + 1
}

export function computeTransfers(allocations: GroupAllocation[]): Transfer[] {
  const debtors = allocations
    .filter(a => a.net < 0)
    .map(a => ({ a, remaining: -a.net }))
    .sort((x, y) => y.remaining - x.remaining)
  const creditors = allocations
    .filter(a => a.net > 0)
    .map(a => ({ a, remaining: a.net }))
    .sort((x, y) => y.remaining - x.remaining)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const amount = Math.min(d.remaining, c.remaining)
    if (amount > 0) {
      transfers.push({
        from_group_id: d.a.group_id,
        from_group_name: d.a.group_name,
        to_group_id: c.a.group_id,
        to_group_name: c.a.group_name,
        amount,
      })
    }
    d.remaining -= amount
    c.remaining -= amount
    if (d.remaining === 0) i++
    if (c.remaining === 0) j++
  }
  return transfers
}

export type SplitInput = {
  year: number
  mainGroups: { id: number; name: string; ownership_pct: number }[]
  // Every property group's members, so `who: user_group` can reference
  // non-main groups too.
  groupMembers: Map<number, number[]>
  userToMainGroup: Map<number, number>
  headUserIds: Set<number>
  childUserIds: Set<number>
  expenses: {
    amount: number
    payer_id: number
    reimbursed_by_id: number | null
    expense_types: string[]
    date: string
  }[]
  categoryNameById: Map<number, string>
  bookings: {
    booker_id: number
    start_date: string
    end_date: string
    occupant_user_ids: number[]
    extra_count: number
  }[]
  priorityWeeks: { user_group_id: number; iso_week: number }[]
}

export type PolicySplitResult = {
  total_reimbursed: number
  total_booking_days: number | null
  groups: GroupAllocation[]
}

function isoWeekRange(
  year: number,
  week: number,
): { start: Temporal.PlainDate; end: Temporal.PlainDate } {
  const jan4 = Temporal.PlainDate.from({ year, month: 1, day: 4 })
  const week1Monday = jan4.subtract({ days: jan4.dayOfWeek - 1 })
  const start = week1Monday.add({ weeks: week - 1 })
  return { start, end: start.add({ days: 6 }) }
}

type DateRange = { start: Temporal.PlainDate; end: Temporal.PlainDate }

// Resolve an `MM-DD` against a concrete year, clamping an impossible day (e.g.
// 02-29 in a common year) to the month's last day. Returns null on malformed
// input so the caller counts zero windowed days rather than throwing.
function monthDayToDate(md: string, year: number): Temporal.PlainDate | null {
  const m = /^(\d{2})-(\d{2})$/.exec(md)
  if (m == null) return null
  try {
    return Temporal.PlainDate.from(
      { year, month: Number(m[1]), day: Number(m[2]) },
      { overflow: "constrain" },
    )
  } catch {
    return null
  }
}

// Resolve a manual month/day occupancy window into concrete ranges for the
// settlement year. `from_md <= to_md` is a single range; `from_md > to_md` wraps
// across the new year (Jan 1..to and from..Dec 31). Empty for malformed input.
function customRangesForYear(
  from_md: string,
  to_md: string,
  year: number,
): DateRange[] {
  const from = monthDayToDate(from_md, year)
  const to = monthDayToDate(to_md, year)
  if (from == null || to == null) return []
  if (Temporal.PlainDate.compare(from, to) <= 0) return [{ start: from, end: to }]
  return [
    { start: Temporal.PlainDate.from({ year, month: 1, day: 1 }), end: to },
    { start: from, end: Temporal.PlainDate.from({ year, month: 12, day: 31 }) },
  ]
}

// Inclusive-day count of the part of [start, end] that falls within the union of
// `windows`. Used to scope person-days to a priority-week window; overlapping
// windows are merged so shared days are not double-counted.
function daysWithinWindows(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  windows: DateRange[],
): number {
  const clipped: DateRange[] = []
  for (const w of windows) {
    const s = Temporal.PlainDate.compare(start, w.start) >= 0 ? start : w.start
    const e = Temporal.PlainDate.compare(end, w.end) <= 0 ? end : w.end
    if (Temporal.PlainDate.compare(s, e) <= 0) clipped.push({ start: s, end: e })
  }
  if (clipped.length === 0) return 0
  clipped.sort((a, b) => Temporal.PlainDate.compare(a.start, b.start))
  let total = 0
  let curStart = clipped[0].start
  let curEnd = clipped[0].end
  for (let i = 1; i < clipped.length; i++) {
    const c = clipped[i]
    if (Temporal.PlainDate.compare(c.start, curEnd) <= 0) {
      if (Temporal.PlainDate.compare(c.end, curEnd) > 0) curEnd = c.end
    } else {
      total += curStart.until(curEnd).days + 1
      curStart = c.start
      curEnd = c.end
    }
  }
  return total + curStart.until(curEnd).days + 1
}

function ruleMatchesExpense(
  what: SplitPolicyWhat,
  expenseTypes: string[],
  categoryNameById: Map<number, string>,
): boolean {
  const w = normalizeWhat(what)
  if (w.kind === "total") return true
  // A rule may target several categories — it matches when the expense carries
  // any one of them.
  return w.category_ids.some(id => {
    const name = categoryNameById.get(id)
    return name != null && expenseTypes.includes(name)
  })
}

function isMainGroupsOnly(who: readonly SplitPolicyWho[]): boolean {
  return who.length === 1 && who[0].kind === "main_groups"
}

export function computePolicySplit(
  config: SplitPolicyConfig,
  input: SplitInput,
  parameters: readonly SplitPolicyParameter[],
): PolicySplitResult {
  const bookingDaysEnabled = parameters.includes("booking_days")
  const occupancy = resolveOccupancy(config, parameters)
  const allUserIds = [...input.userToMainGroup.keys()]
  const mainGroupIds = input.mainGroups.map(g => g.id)
  const ownershipByGroup = new Map(
    input.mainGroups.map(g => [g.id, g.ownership_pct]),
  )

  const priorityRangesByGroup = new Map<number, DateRange[]>()
  for (const pw of input.priorityWeeks) {
    const list = priorityRangesByGroup.get(pw.user_group_id) ?? []
    list.push(isoWeekRange(input.year, pw.iso_week))
    priorityRangesByGroup.set(pw.user_group_id, list)
  }
  const allPriorityRanges = [...priorityRangesByGroup.values()].flat()

  // The window that scopes person-day counting (occupancy.window). `null` =
  // count every night; otherwise only nights overlapping these ranges count.
  const weightWindows = ((w: SplitPolicyOccupancyWindow): DateRange[] | null => {
    switch (w.kind) {
      case "year":
        return null
      case "any_priority_week":
        return allPriorityRanges
      case "priority_week":
        return priorityRangesByGroup.get(w.user_group_id) ?? []
      case "custom_range":
        return customRangesForYear(w.from_md, w.to_md, input.year)
    }
  })(occupancy.window)

  // memberDaysByUser/Group and extraDays* are the raw full-year occupancy used
  // for the informational "booking days" column and the present_this_year check.
  // weightByUser/Group are the windowed, child-weighted person-days that actually
  // drive a weighted_by_occupancy split.
  const memberDaysByUser = new Map<number, number>()
  const weightByUser = new Map<number, number>()
  const extraDaysByBooker = new Map<number, number>()
  const extraWeightByBooker = new Map<number, number>()
  const bookingsByUser = new Map<number, DateRange[]>()
  for (const b of input.bookings) {
    const days = inclusiveDayCount(b.start_date, b.end_date)
    const range = {
      start: plainDateFromDb(b.start_date),
      end: plainDateFromDb(b.end_date),
    }
    const windowDays =
      weightWindows == null
        ? days
        : daysWithinWindows(range.start, range.end, weightWindows)
    for (const userId of b.occupant_user_ids) {
      memberDaysByUser.set(userId, (memberDaysByUser.get(userId) ?? 0) + days)
      const childFactor = input.childUserIds.has(userId)
        ? occupancy.child_weight
        : 1
      weightByUser.set(
        userId,
        (weightByUser.get(userId) ?? 0) + windowDays * childFactor,
      )
      const list = bookingsByUser.get(userId) ?? []
      list.push(range)
      bookingsByUser.set(userId, list)
    }
    if (b.extra_count > 0) {
      extraDaysByBooker.set(
        b.booker_id,
        (extraDaysByBooker.get(b.booker_id) ?? 0) + b.extra_count * days,
      )
      if (occupancy.include_extra_guests) {
        extraWeightByBooker.set(
          b.booker_id,
          (extraWeightByBooker.get(b.booker_id) ?? 0) +
            b.extra_count * windowDays,
        )
      }
    }
  }

  const sumByGroup = (byUser: Map<number, number>): Map<number, number> => {
    const byGroup = new Map<number, number>()
    for (const [userId, days] of byUser) {
      const g = input.userToMainGroup.get(userId)
      if (g == null) continue
      byGroup.set(g, (byGroup.get(g) ?? 0) + days)
    }
    return byGroup
  }
  const memberDaysByGroup = sumByGroup(memberDaysByUser)
  const extraDaysByGroup = sumByGroup(extraDaysByBooker)
  const weightByGroup = sumByGroup(weightByUser)
  const extraWeightByGroup = sumByGroup(extraWeightByBooker)

  const userPassesWhen = (
    userId: number,
    when: SplitPolicyRule["when"],
    expenseDate: string,
  ): boolean => {
    switch (when.kind) {
      case "always":
        return true
      case "present_when_expense_added": {
        const date = plainDateFromDb(expenseDate)
        return (
          bookingsByUser
            .get(userId)
            ?.some(
              s =>
                Temporal.PlainDate.compare(s.start, date) <= 0 &&
                Temporal.PlainDate.compare(date, s.end) <= 0,
            ) ?? false
        )
      }
      case "present_this_year":
        return memberDaysByUser.has(userId)
      case "present_any_priority_week":
        return (
          bookingsByUser
            .get(userId)
            ?.some(s => daysWithinWindows(s.start, s.end, allPriorityRanges) > 0) ??
          false
        )
      case "present_priority_week": {
        const ranges = priorityRangesByGroup.get(when.user_group_id) ?? []
        return (
          bookingsByUser
            .get(userId)
            ?.some(s => daysWithinWindows(s.start, s.end, ranges) > 0) ?? false
        )
      }
    }
  }

  const expandWho = (who: readonly SplitPolicyWho[]): Set<number> => {
    const users = new Set<number>()
    const addIfMember = (userId: number) => {
      if (input.userToMainGroup.has(userId)) users.add(userId)
    }
    for (const w of who) {
      switch (w.kind) {
        case "all_users":
        case "main_groups":
          allUserIds.forEach(addIfMember)
          break
        case "user_group":
          ;(input.groupMembers.get(w.group_id) ?? []).forEach(addIfMember)
          break
        case "user":
          addIfMember(w.user_id)
          break
        case "heads_only":
          input.headUserIds.forEach(addIfMember)
          break
      }
    }
    return users
  }

  const floatShareByGroup = new Map<number, number>()
  const addGroupShares = (weights: Map<number, number>, amount: number) => {
    const totalWeight = [...weights.values()].reduce((s, v) => s + v, 0)
    const entries = [...weights.entries()]
    for (const [groupId, weight] of entries) {
      const portion =
        totalWeight > 0
          ? (amount * weight) / totalWeight
          : amount / entries.length
      floatShareByGroup.set(
        groupId,
        (floatShareByGroup.get(groupId) ?? 0) + portion,
      )
    }
  }

  // Allocate one expense amount under one rule. Group-level resolution only
  // when targeting exactly the main groups with no exclusions; otherwise the
  // who-set expands to users that fold back into their main group.
  const allocateExpense = (
    rule: SplitPolicyRule | SplitPolicyFallback,
    amount: number,
    expenseDate: string,
  ) => {
    const groupMode = isMainGroupsOnly(rule.who) && rule.except.length === 0

    if (groupMode) {
      let targets = mainGroupIds
      if (rule.when.kind !== "always") {
        targets = targets.filter(g =>
          (input.groupMembers.get(g) ?? []).some(u =>
            userPassesWhen(u, rule.when, expenseDate),
          ),
        )
      }
      if (targets.length === 0) targets = mainGroupIds
      const weights = new Map<number, number>()
      for (const g of targets) {
        switch (rule.how.kind) {
          case "equally":
            weights.set(g, 1)
            break
          case "by_ownership_pct":
            weights.set(g, ownershipByGroup.get(g) ?? 0)
            break
          case "weighted_by_occupancy":
            weights.set(
              g,
              (weightByGroup.get(g) ?? 0) + (extraWeightByGroup.get(g) ?? 0),
            )
            break
        }
      }
      addGroupShares(weights, amount)
      return
    }

    let users = [...expandWho(rule.who)]
    if (rule.when.kind !== "always") {
      users = users.filter(u => userPassesWhen(u, rule.when, expenseDate))
    }
    const excludedGroups = new Set<number>()
    for (const ex of rule.except) {
      if (ex.kind === "group") excludedGroups.add(ex.group_id)
    }
    users = users.filter(u => {
      const groupId = input.userToMainGroup.get(u)
      if (groupId != null && excludedGroups.has(groupId)) return false
      return !rule.except.some(
        ex =>
          (ex.kind === "user" && ex.user_id === u) ||
          (ex.kind === "kids" && input.childUserIds.has(u)) ||
          (ex.kind === "group" &&
            (input.groupMembers.get(ex.group_id) ?? []).includes(u)),
      )
    })
    if (users.length === 0) {
      addGroupShares(new Map(mainGroupIds.map(g => [g, 1])), amount)
      return
    }

    if (rule.how.kind === "by_ownership_pct") {
      const groups = [
        ...new Set(users.flatMap(u => input.userToMainGroup.get(u) ?? [])),
      ]
      let weights = new Map(groups.map(g => [g, ownershipByGroup.get(g) ?? 0]))
      if ([...weights.values()].every(w => w === 0)) {
        weights = new Map(groups.map(g => [g, 1]))
      }
      addGroupShares(weights, amount)
      return
    }

    let userWeights: Map<number, number>
    if (rule.how.kind === "weighted_by_occupancy") {
      userWeights = new Map(
        users.map(u => [
          u,
          (weightByUser.get(u) ?? 0) + (extraWeightByBooker.get(u) ?? 0),
        ]),
      )
      if ([...userWeights.values()].every(w => w === 0)) {
        userWeights = new Map(users.map(u => [u, 1]))
      }
    } else {
      userWeights = new Map(users.map(u => [u, 1]))
    }
    const groupWeights = new Map<number, number>()
    for (const [u, w] of userWeights) {
      const g = input.userToMainGroup.get(u)
      if (g == null) continue
      groupWeights.set(g, (groupWeights.get(g) ?? 0) + w)
    }
    addGroupShares(groupWeights, amount)
  }

  const paidByGroup = new Map<number, number>()
  let totalReimbursed = 0
  for (const e of input.expenses) {
    totalReimbursed += e.amount
    const effectivePayer = e.reimbursed_by_id ?? e.payer_id
    const groupId = input.userToMainGroup.get(effectivePayer)
    if (groupId != null) {
      paidByGroup.set(groupId, (paidByGroup.get(groupId) ?? 0) + e.amount)
    }

    const rule =
      config.rules.find(r =>
        ruleMatchesExpense(r.what, e.expense_types, input.categoryNameById),
      ) ?? config.fallback
    allocateExpense(rule, e.amount, e.date)
  }

  const allocations: GroupAllocation[] = input.mainGroups.map(g => {
    const share = Math.round(floatShareByGroup.get(g.id) ?? 0)
    const paid = paidByGroup.get(g.id) ?? 0
    const days = bookingDaysEnabled
      ? (memberDaysByGroup.get(g.id) ?? 0) + (extraDaysByGroup.get(g.id) ?? 0)
      : null
    return {
      group_id: g.id,
      group_name: g.name,
      booking_days: days,
      total_paid: paid,
      total_share: share,
      net: paid - share,
    }
  })

  const sumShares = allocations.reduce((s, a) => s + a.total_share, 0)
  const drift = totalReimbursed - sumShares
  if (drift !== 0 && allocations.length > 0) {
    let largest = allocations[0]
    for (const a of allocations) {
      if (a.total_share > largest.total_share) largest = a
    }
    largest.total_share += drift
    largest.net = largest.total_paid - largest.total_share
  }

  const totalDays = bookingDaysEnabled
    ? allocations.reduce((s, a) => s + (a.booking_days ?? 0), 0)
    : null

  return {
    total_reimbursed: totalReimbursed,
    total_booking_days: totalDays,
    groups: allocations,
  }
}

export async function loadSplitInput(
  db: Db,
  settlement: { id: number; property_id: number; year: number },
  parameters: readonly SplitPolicyParameter[],
): Promise<SplitInput> {
  const groups = await db
    .select({
      id: userGroupsTable.id,
      is_family: userGroupsTable.is_family,
      name: userGroupsTable.name,
    })
    .from(userGroupsTable)
    .where(eq(userGroupsTable.property_id, settlement.property_id))
  const groupIds = groups.map(g => g.id)
  const familyGroupIds = new Set(groups.filter(g => g.is_family).map(g => g.id))

  const owners = await db
    .select({
      user_group_id: propertyOwnersTable.user_group_id,
      ownership_pct: propertyOwnersTable.ownership_pct,
    })
    .from(propertyOwnersTable)
    .where(eq(propertyOwnersTable.property_id, settlement.property_id))
  const ownershipByGroup = new Map(
    owners.map(o => [o.user_group_id, Number(o.ownership_pct)]),
  )
  // Main groups mirror the legacy preview: family groups that own the property.
  const mainGroups = groups
    .filter(g => g.is_family && ownershipByGroup.has(g.id))
    .map(g => ({
      id: g.id,
      name: g.name,
      ownership_pct: ownershipByGroup.get(g.id) ?? 0,
    }))

  const memberRows = groupIds.length
    ? await db
        .select({
          user_group_id: userGroupMembersTable.user_group_id,
          user_id: userGroupMembersTable.user_id,
          is_head: userGroupMembersTable.is_head,
          is_child: usersTable.is_child,
        })
        .from(userGroupMembersTable)
        .innerJoin(usersTable, eq(usersTable.id, userGroupMembersTable.user_id))
        .where(inArray(userGroupMembersTable.user_group_id, groupIds))
    : []

  const groupMembers = new Map<number, number[]>()
  const userToMainGroup = new Map<number, number>()
  const headUserIds = new Set<number>()
  const childUserIds = new Set<number>()
  const mainGroupIds = new Set(mainGroups.map(g => g.id))
  for (const m of memberRows) {
    const list = groupMembers.get(m.user_group_id) ?? []
    list.push(m.user_id)
    groupMembers.set(m.user_group_id, list)
    if (mainGroupIds.has(m.user_group_id)) {
      userToMainGroup.set(m.user_id, m.user_group_id)
    }
    if (m.is_head && familyGroupIds.has(m.user_group_id)) {
      headUserIds.add(m.user_id)
    }
    if (m.is_child) childUserIds.add(m.user_id)
  }

  const headIds = [...headUserIds]
  const expenses = await db
    .select({
      amount: expensesTable.amount,
      payer_id: expensesTable.payer_id,
      reimbursed_by_id: expensesTable.reimbursed_by_id,
      expense_types: expensesTable.expense_types,
      date: expensesTable.date,
    })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.settlement_id, settlement.id),
        or(
          eq(expensesTable.status, "reimbursed"),
          headIds.length > 0
            ? and(
                eq(expensesTable.status, "submitted"),
                inArray(expensesTable.payer_id, headIds),
              )
            : undefined,
        ),
      ),
    )

  const categories = await db
    .select({
      id: expenseCategoriesTable.id,
      name: expenseCategoriesTable.name,
    })
    .from(expenseCategoriesTable)
    .where(eq(expenseCategoriesTable.property_id, settlement.property_id))

  let bookings: SplitInput["bookings"] = []
  if (parameters.includes("booking_days")) {
    const bookingRows = await db
      .select({
        id: bookingTable.id,
        booker_id: bookingTable.booker_id,
        start_date: bookingTable.start_date,
        end_date: bookingTable.end_date,
        status: bookingTable.status,
      })
      .from(bookingTable)
      .where(eq(bookingTable.property_id, settlement.property_id))
    const adjustmentRows = await db
      .select({
        booking_id: settlementBookingAdjustmentsTable.booking_id,
        excluded: settlementBookingAdjustmentsTable.excluded,
        extra_names: settlementBookingAdjustmentsTable.extra_names,
      })
      .from(settlementBookingAdjustmentsTable)
      .where(eq(settlementBookingAdjustmentsTable.settlement_id, settlement.id))
    const adjustmentsByBooking = new Map(
      adjustmentRows.map(a => [a.booking_id, a]),
    )
    const eligible = bookingRows.filter(b => {
      if (b.status === "cancelled") return false
      return !(adjustmentsByBooking.get(b.id)?.excluded ?? false)
    })
    const bookingIds = eligible.map(b => b.id)
    const occupants = bookingIds.length
      ? await db
          .select({
            booking_id: bookingOccupantsTable.booking_id,
            user_id: bookingOccupantsTable.user_id,
          })
          .from(bookingOccupantsTable)
          .where(inArray(bookingOccupantsTable.booking_id, bookingIds))
      : []
    const occupantsByBooking = new Map<number, number[]>()
    for (const o of occupants) {
      const list = occupantsByBooking.get(o.booking_id) ?? []
      list.push(o.user_id)
      occupantsByBooking.set(o.booking_id, list)
    }
    bookings = eligible.map(b => ({
      booker_id: b.booker_id,
      start_date: b.start_date,
      end_date: b.end_date,
      occupant_user_ids: occupantsByBooking.get(b.id) ?? [],
      extra_count: (adjustmentsByBooking.get(b.id)?.extra_names ?? []).length,
    }))
  }

  const priorityWeeks = parameters.includes("time_conditions")
    ? await db
        .select({
          user_group_id: propertyPriorityWeeksTable.user_group_id,
          iso_week: propertyPriorityWeeksTable.iso_week,
        })
        .from(propertyPriorityWeeksTable)
        .where(
          and(
            eq(propertyPriorityWeeksTable.property_id, settlement.property_id),
            eq(propertyPriorityWeeksTable.year, settlement.year),
          ),
        )
    : []

  return {
    year: settlement.year,
    mainGroups,
    groupMembers,
    userToMainGroup,
    headUserIds,
    childUserIds,
    expenses,
    categoryNameById: new Map(categories.map(c => [c.id, c.name])),
    bookings,
    priorityWeeks,
  }
}
