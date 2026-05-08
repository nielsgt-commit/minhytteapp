import "dotenv/config"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import { db, pool } from "./client.ts"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "./schema/booking.schema.ts"
import {
  equipmentTable,
  maintenanceTable,
} from "./schema/maintenance.schema.ts"
import {
  buildingsTable,
  propertyContactsTable,
  propertyOwnersTable,
  propertyPriorityWeeksTable,
  propertyTable,
  roomTable,
} from "./schema/property.schema.ts"
import { expensesTable } from "./schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "./schema/users.schema.ts"

type SeedUser = {
  name: string
  is_admin?: boolean
  is_head?: boolean
}

const SEED_USERS: SeedUser[] = [
  { name: "Admin", is_admin: true },
  { name: "Jo", is_head: true },
  { name: "Thomas", is_head: true },
  { name: "Siri", is_head: true },
  { name: "Mari" },
  { name: "Jens" },
  { name: "Maja" },
  { name: "Sara" },
  { name: "Peder" },
  { name: "Jonas" },
  { name: "Sofie" },
  { name: "Ardis" },
  { name: "Anita" },
  { name: "Rasmus" },
  { name: "Peik" },
  { name: "Jørgen" },
]

type SeedUserGroup = {
  name: string
  is_main?: boolean
  member_user_names: string[]
}

const SEED_USER_GROUPS: SeedUserGroup[] = [
  {
    name: "Jo family",
    is_main: true,
    member_user_names: ["Jo", "Mari", "Jens", "Sofie", "Ardis"],
  },
  {
    name: "Thomas family",
    is_main: true,
    member_user_names: ["Thomas", "Maja", "Sara", "Anita"],
  },
  {
    name: "Siri family",
    is_main: true,
    member_user_names: ["Siri", "Peder", "Jonas", "Rasmus", "Peik", "Jørgen"],
  },
]

const SEED_PROPERTY = { name: "Furua", address: "—" }

type SeedRoom = {
  name: string
  beds_sm?: number
  beds_lg?: number
  beds_double?: number
  beds_kid?: number
  mattresses?: number
  travel_cot?: number
}

type SeedBuilding = {
  name: string
  rooms: SeedRoom[]
}

const SEED_BUILDINGS: SeedBuilding[] = [
  {
    name: "Furua",
    rooms: [
      { name: "Main bedroom", beds_double: 1, beds_kid: 2, travel_cot: 1 },
    ],
  },
  {
    name: "Naustet",
    rooms: [
      { name: "Store", beds_double: 1, beds_kid: 2, travel_cot: 1 },
      { name: "Lille", beds_double: 1, beds_kid: 2 },
    ],
  },
  {
    name: "Slabeslottet",
    rooms: [
      { name: "Slabeslottet", beds_double: 1, travel_cot: 1 },
    ],
  },
  {
    name: "Nybygget",
    rooms: [
      { name: "Laffen", beds_double: 1, travel_cot: 1 },
      { name: "Styx", beds_sm: 1, beds_double: 1, travel_cot: 1 },
      { name: "Jesse", beds_sm: 1, beds_double: 1, travel_cot: 1 },
      { name: "Nystua", mattresses: 4 },
    ],
  },
  {
    name: "Kabelpalasset",
    rooms: [],
  },
]

const PEAK_WEEKS = [28, 29, 30] as const
const SEED_PRIORITY_YEAR = new Date().getUTCFullYear()
const SEED_EXPENSE_WEEKS = [28, 29, 30] as const
const SEED_EXPENSE_YEAR = new Date().getUTCFullYear()

function mondayOfIsoWeekUTC(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const out = new Date(jan4)
  out.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7)
  return out
}

async function upsertUser(seed: SeedUser) {
  const oauth_sub = seed.name
  const email = `${seed.name}@oauth.local`
  const legacyPendingEmail = `pending-${seed.name}@example.local`
  const is_admin = seed.is_admin ?? false
  const is_head = seed.is_head ?? false
  const existing = (
    await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.email, email),
          eq(usersTable.email, legacyPendingEmail),
        ),
      )
      .limit(1)
  ).at(0)
  if (existing) {
    const drift =
      existing.email !== email ||
      existing.is_admin !== is_admin ||
      existing.is_head !== is_head ||
      existing.oauth_sub !== oauth_sub
    if (!drift) {
      console.log(`found user #${String(existing.id)} (${existing.email})`)
      return existing
    }
    const [updated] = await db
      .update(usersTable)
      .set({ email, is_admin, is_head, oauth_sub })
      .where(eq(usersTable.id, existing.id))
      .returning()
    console.log(
      `updated user #${String(updated.id)} (${updated.email}) -> admin=${String(updated.is_admin)}, head=${String(updated.is_head)}, sub=${String(updated.oauth_sub)}`,
    )
    return updated
  }
  const created = (
    await db
      .insert(usersTable)
      .values({
        name: seed.name,
        email,
        oauth_sub,
        is_admin,
        is_head,
      })
      .returning()
  ).at(0)
  if (!created) throw new Error(`failed to insert user ${seed.name}`)
  console.log(`inserted user #${String(created.id)} (${created.email})`)
  return created
}

async function upsertProperty() {
  const existing = (
    await db
      .select()
      .from(propertyTable)
      .where(eq(propertyTable.name, SEED_PROPERTY.name))
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(
      `found property #${String(existing.id)} (${existing.name})`,
    )
    return existing
  }
  const created = (
    await db.insert(propertyTable).values(SEED_PROPERTY).returning()
  ).at(0)
  if (!created) throw new Error("failed to insert property")
  console.log(`inserted property #${String(created.id)} (${created.name})`)
  return created
}

async function upsertBuilding(property_id: number, name: string) {
  const existing = (
    await db
      .select()
      .from(buildingsTable)
      .where(
        and(
          eq(buildingsTable.property_id, property_id),
          eq(buildingsTable.name, name),
        ),
      )
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(`found building #${String(existing.id)} (${existing.name})`)
    return existing
  }
  const created = (
    await db
      .insert(buildingsTable)
      .values({ name, property_id })
      .returning()
  ).at(0)
  if (!created) throw new Error(`failed to insert building ${name}`)
  console.log(`inserted building #${String(created.id)} (${created.name})`)
  return created
}

async function upsertRoom(building_id: number, seed: SeedRoom) {
  const existing = (
    await db
      .select()
      .from(roomTable)
      .where(
        and(
          eq(roomTable.building_id, building_id),
          eq(roomTable.name, seed.name),
        ),
      )
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(`found room #${String(existing.id)} (${existing.name})`)
    return existing
  }
  const created = (
    await db
      .insert(roomTable)
      .values({
        name: seed.name,
        building_id,
        beds_sm: seed.beds_sm ?? 0,
        beds_lg: seed.beds_lg ?? 0,
        beds_double: seed.beds_double ?? 0,
        beds_kid: seed.beds_kid ?? 0,
        mattresses: seed.mattresses ?? 0,
        travel_cot: seed.travel_cot ?? 0,
      })
      .returning()
  ).at(0)
  if (!created) throw new Error(`failed to insert room ${seed.name}`)
  console.log(`inserted room #${String(created.id)} (${created.name})`)
  return created
}

async function upsertOwner(property_id: number, user_id: number, pct: string) {
  const existing = (
    await db
      .select()
      .from(propertyOwnersTable)
      .where(
        and(
          eq(propertyOwnersTable.property_id, property_id),
          eq(propertyOwnersTable.user_id, user_id),
          isNull(propertyOwnersTable.user_group_id),
        ),
      )
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(
      `found owner #${String(existing.id)} (user ${String(user_id)}, ${existing.ownership_pct}%)`,
    )
    return existing
  }
  const created = (
    await db
      .insert(propertyOwnersTable)
      .values({ property_id, user_id, ownership_pct: pct })
      .returning()
  ).at(0)
  if (!created) throw new Error(`failed to insert owner for user ${String(user_id)}`)
  console.log(
    `inserted owner #${String(created.id)} (user ${String(user_id)}, ${created.ownership_pct}%)`,
  )
  return created
}

async function upsertUserGroup(seed: SeedUserGroup) {
  const existing = (
    await db
      .select()
      .from(userGroupsTable)
      .where(eq(userGroupsTable.name, seed.name))
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(`found user group #${String(existing.id)} (${existing.name})`)
    return existing
  }
  const created = (
    await db
      .insert(userGroupsTable)
      .values({ name: seed.name, is_main: seed.is_main ?? false })
      .returning()
  ).at(0)
  if (!created) throw new Error(`failed to insert user group ${seed.name}`)
  console.log(`inserted user group #${String(created.id)} (${created.name})`)
  return created
}

async function upsertUserGroupMember(user_group_id: number, user_id: number) {
  const existing = (
    await db
      .select()
      .from(userGroupMembersTable)
      .where(
        and(
          eq(userGroupMembersTable.user_group_id, user_group_id),
          eq(userGroupMembersTable.user_id, user_id),
        ),
      )
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(
      `found member (group ${String(user_group_id)}, user ${String(user_id)})`,
    )
    return existing
  }
  const created = (
    await db
      .insert(userGroupMembersTable)
      .values({ user_group_id, user_id })
      .returning()
  ).at(0)
  if (!created) {
    throw new Error(
      `failed to insert membership (group ${String(user_group_id)}, user ${String(user_id)})`,
    )
  }
  console.log(
    `inserted member (group ${String(user_group_id)}, user ${String(user_id)})`,
  )
  return created
}

async function upsertPriorityWeek(
  property_id: number,
  property_owner_id: number,
  year: number,
  iso_week: number,
) {
  const existing = (
    await db
      .select()
      .from(propertyPriorityWeeksTable)
      .where(
        and(
          eq(propertyPriorityWeeksTable.property_owner_id, property_owner_id),
          eq(propertyPriorityWeeksTable.year, year),
        ),
      )
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(
      `found priority week #${String(existing.id)} (owner ${String(property_owner_id)}, ${String(year)} W${String(existing.iso_week)})`,
    )
    return existing
  }
  const created = (
    await db
      .insert(propertyPriorityWeeksTable)
      .values({ property_id, property_owner_id, year, iso_week })
      .returning()
  ).at(0)
  if (!created) {
    throw new Error(
      `failed to insert priority week for owner ${String(property_owner_id)}`,
    )
  }
  console.log(
    `inserted priority week #${String(created.id)} (owner ${String(property_owner_id)}, ${String(year)} W${String(created.iso_week)})`,
  )
  return created
}

type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"
type ExpenseStatus = "draft" | "submitted" | "reimbursed" | "rejected"

const EXPENSE_TYPES: ExpenseType[] = [
  "food",
  "gas",
  "maintenance",
  "capex",
  "opex",
  "fixed",
]

const EXPENSE_STATUSES: ExpenseStatus[] = [
  "draft",
  "submitted",
  "reimbursed",
  "rejected",
]

const EXPENSE_DESCRIPTIONS = [
  "Groceries",
  "Petrol fill-up",
  "Plumber visit",
  "Roof repair",
  "Firewood delivery",
  "Cleaning supplies",
  "Hardware store",
  "Paint and brushes",
  "Insurance premium",
  "Property tax",
  "Internet bill",
  "Electricity bill",
  "Water bill",
  "New mattress",
  "Snow removal",
  "Lawn mowing",
  "Septic service",
  "Coffee and pastries",
]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const EXPENSE_COUNT = 100

async function seedExpenses(payerIds: number[], reimburserIds: number[]) {
  if (payerIds.length === 0) {
    console.log("skip expenses: no payers")
    return
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expensesTable)
  if (count >= EXPENSE_COUNT) {
    console.log(`found ${String(count)} expenses, skipping seed`)
    return
  }

  const rng = mulberry32(0xc0ffee)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)]
  const pickInt = (lo: number, hi: number) =>
    lo + Math.floor(rng() * (hi - lo + 1))

  const startDate = mondayOfIsoWeekUTC(SEED_EXPENSE_YEAR, SEED_EXPENSE_WEEKS[0])
  const totalDays = SEED_EXPENSE_WEEKS.length * 7
  const rows: (typeof expensesTable.$inferInsert)[] = []
  const remaining = EXPENSE_COUNT - count
  for (let i = 0; i < remaining; i++) {
    const payer_id = pick(payerIds)
    const status = pick(EXPENSE_STATUSES)
    const reimbursableCandidates = reimburserIds.filter(id => id !== payer_id)
    const wantsReimburser =
      status === "reimbursed" || (status === "submitted" && rng() < 0.4)
    const reimbursed_by_id =
      wantsReimburser && reimbursableCandidates.length > 0
        ? pick(reimbursableCandidates)
        : null
    if (status === "reimbursed" && reimbursed_by_id == null) continue

    const numTypes = pickInt(0, 3)
    const shuffled = [...EXPENSE_TYPES].sort(() => rng() - 0.5)
    const picked = shuffled.slice(0, numTypes)
    const expense_types: ExpenseType[] = picked.includes("fixed")
      ? ["fixed"]
      : picked

    const dayOffset = pickInt(0, totalDays - 1)
    const d = new Date(startDate)
    d.setUTCDate(d.getUTCDate() + dayOffset)
    const isoDate = d.toISOString().slice(0, 10)

    const description = rng() < 0.85 ? pick(EXPENSE_DESCRIPTIONS) : ""
    const receipt_url =
      rng() < 0.5 ? `https://receipts.local/r/${String(i + 1)}` : null
    const amount = pickInt(20, 8000) * (rng() < 0.5 ? 1 : 10)

    rows.push({
      description,
      amount,
      payer_id,
      reimbursed_by_id,
      date: isoDate,
      status,
      receipt_url,
      expense_types,
    })
  }

  if (rows.length === 0) {
    console.log("no new expenses to insert")
    return
  }
  const inserted = await db.insert(expensesTable).values(rows).returning()
  console.log(`inserted ${String(inserted.length)} expenses`)
}

const BOOKING_COUNT = 30
const BOOKING_NOTES = [
  "Family weekend",
  "Just me",
  "Quick visit",
  "Long stay",
  "Cousins coming",
  "Solo work week",
  "Birthday",
  "Anniversary",
]

type RoomCap = {
  id: number
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

type BedAlloc = {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

function roomCapacity(r: RoomCap) {
  return (
    r.beds_sm +
    r.beds_lg +
    r.beds_double * 2 +
    r.beds_kid +
    r.mattresses +
    r.travel_cot
  )
}

function allocateAdults(r: RoomCap, n: number): BedAlloc {
  const out: BedAlloc = {
    beds_sm: 0,
    beds_lg: 0,
    beds_double: 0,
    beds_kid: 0,
    mattresses: 0,
    travel_cot: 0,
  }
  let left = n
  const takeSm = Math.min(left, r.beds_sm)
  out.beds_sm = takeSm
  left -= takeSm
  const takeLg = Math.min(left, r.beds_lg)
  out.beds_lg = takeLg
  left -= takeLg
  const doubleSlots = Math.min(left, r.beds_double * 2)
  out.beds_double = Math.ceil(doubleSlots / 2)
  left -= doubleSlots
  const takeMat = Math.min(left, r.mattresses)
  out.mattresses = takeMat
  left -= takeMat
  const takeKid = Math.min(left, r.beds_kid)
  out.beds_kid = takeKid
  left -= takeKid
  return out
}

async function seedBookings(
  property_id: number,
  groupMemberIds: Map<number, number[]>,
) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingTable)
  if (count >= BOOKING_COUNT) {
    console.log(`found ${String(count)} bookings, skipping seed`)
    return
  }

  const groupIds = [...groupMemberIds.keys()].filter(
    id => (groupMemberIds.get(id) ?? []).length > 0,
  )
  if (groupIds.length === 0) {
    console.log("skip bookings: no groups with members")
    return
  }

  const propertyRooms: RoomCap[] = await db
    .select({
      id: roomTable.id,
      beds_sm: roomTable.beds_sm,
      beds_lg: roomTable.beds_lg,
      beds_double: roomTable.beds_double,
      beds_kid: roomTable.beds_kid,
      mattresses: roomTable.mattresses,
      travel_cot: roomTable.travel_cot,
    })
    .from(roomTable)
    .innerJoin(buildingsTable, eq(buildingsTable.id, roomTable.building_id))
    .where(eq(buildingsTable.property_id, property_id))

  if (propertyRooms.length === 0) {
    console.log("skip bookings: property has no rooms")
    return
  }

  const rng = mulberry32(0xb00b1e5)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)]
  const pickInt = (lo: number, hi: number) =>
    lo + Math.floor(rng() * (hi - lo + 1))

  const startMonday = mondayOfIsoWeekUTC(SEED_PRIORITY_YEAR, PEAK_WEEKS[0])
  const totalDays = PEAK_WEEKS.length * 7

  type Pending = {
    booker_id: number
    start_date: string
    end_date: string
    notes: string | null
    occupants: number[]
    room_id: number
    beds: BedAlloc
  }
  const pending: Pending[] = []
  const remaining = BOOKING_COUNT - count
  for (let i = 0; i < remaining; i++) {
    const groupId = pick(groupIds)
    const members = groupMemberIds.get(groupId) ?? []
    if (members.length === 0) continue

    const dayStart = pickInt(0, totalDays - 1)
    const maxLen = Math.min(6, totalDays - 1 - dayStart)
    const length = pickInt(0, maxLen)
    const start = new Date(startMonday)
    start.setUTCDate(start.getUTCDate() + dayStart)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + length)

    const booker = pick(members)
    const others = members
      .filter(id => id !== booker)
      .sort(() => rng() - 0.5)
      .slice(0, pickInt(0, Math.min(2, members.length - 1)))
    const occupants = [booker, ...others]

    const fittingRooms = propertyRooms.filter(
      r => roomCapacity(r) >= occupants.length,
    )
    if (fittingRooms.length === 0) continue
    const room = pick(fittingRooms)
    const beds = allocateAdults(room, occupants.length)

    pending.push({
      booker_id: booker,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      notes: rng() < 0.5 ? null : pick(BOOKING_NOTES),
      occupants,
      room_id: room.id,
      beds,
    })
  }

  if (pending.length === 0) {
    console.log("no new bookings to insert")
    return
  }

  const inserted = await db
    .insert(bookingTable)
    .values(
      pending.map(p => ({
        property_id,
        booker_id: p.booker_id,
        start_date: p.start_date,
        end_date: p.end_date,
        status: "confirmed" as const,
        notes: p.notes,
      })),
    )
    .returning({ id: bookingTable.id })

  const bookingRoomRows = pending.map((p, idx) => ({
    booking_id: inserted[idx].id,
    room_id: p.room_id,
    ...p.beds,
  }))
  await db.insert(bookingRoomsTable).values(bookingRoomRows)

  const occupantRows = pending.flatMap((p, idx) =>
    p.occupants.map(uid => ({
      booking_id: inserted[idx].id,
      user_id: uid,
      room_id: p.room_id,
    })),
  )
  await db.insert(bookingOccupantsTable).values(occupantRows)

  console.log(
    `inserted ${String(inserted.length)} bookings (${String(occupantRows.length)} occupants, ${String(bookingRoomRows.length)} room assignments)`,
  )
}

const MAINTENANCE_COUNT = 50
const MAINTENANCE_DONE_PER_BUILDING = 4
const MAINTENANCE_DESCRIPTIONS = [
  "Replace gaskets",
  "Repaint window frames",
  "Inspect roof",
  "Service stove",
  "Fix leaky faucet",
  "Clean gutters",
  "Reseal deck",
  "Replace lightbulbs",
  "Service heat pump",
  "Fix loose floor board",
  "Repair fence",
  "Trim trees",
  "Mow lawn",
  "Wash exterior",
  "Replace smoke detector battery",
  "Tighten cabinet hinges",
  "Lubricate door locks",
  "Replace shower head",
  "Inspect chimney",
  "Caulk bathroom",
]
const MAINTENANCE_CATEGORIES = ["maintenance", "repair"] as const
const MAINTENANCE_SEVERITIES = ["major", "minor", "patch"] as const
const MAINTENANCE_RECURRENCES = ["once", "yearly", "5year"] as const

async function seedMaintenance(buildingIds: number[], userIds: number[]) {
  if (buildingIds.length === 0 || userIds.length === 0) {
    console.log("skip maintenance: missing buildings or users")
    return
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(maintenanceTable)
  if (count >= MAINTENANCE_COUNT) {
    console.log(`found ${String(count)} maintenance items, skipping seed`)
    return
  }

  const rng = mulberry32(0xfa11ed)
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)]

  const referenceMs = Date.UTC(SEED_PRIORITY_YEAR, 0, 1)
  const yearMs = 365 * 24 * 3600 * 1000

  const makeRow = (
    building_id: number,
    status: "todo" | "doing" | "done",
  ): typeof maintenanceTable.$inferInsert => {
    const completed_at =
      status === "done"
        ? new Date(referenceMs + Math.floor(rng() * yearMs))
        : null
    const due_at =
      status !== "done" && rng() < 0.6
        ? new Date(referenceMs + Math.floor(rng() * yearMs))
        : null
    return {
      description: pick(MAINTENANCE_DESCRIPTIONS),
      instructions: rng() < 0.4 ? "see notes" : null,
      added_by: pick(userIds),
      assigned_to_id: rng() < 0.5 ? pick(userIds) : null,
      building_id,
      place_id: null,
      category: pick(MAINTENANCE_CATEGORIES),
      severity: pick(MAINTENANCE_SEVERITIES),
      status,
      recurrence: pick(MAINTENANCE_RECURRENCES),
      due_at,
      completed_at,
    }
  }

  const rows: (typeof maintenanceTable.$inferInsert)[] = []
  for (const bid of buildingIds) {
    for (let i = 0; i < MAINTENANCE_DONE_PER_BUILDING; i++) {
      rows.push(makeRow(bid, "done"))
    }
  }
  while (rows.length < MAINTENANCE_COUNT) {
    const bid = pick(buildingIds)
    const status = pick(["todo", "doing", "done"] as const)
    rows.push(makeRow(bid, status))
  }

  const remaining = MAINTENANCE_COUNT - count
  const toInsert = rows.slice(0, remaining)
  if (toInsert.length === 0) {
    console.log("no new maintenance to insert")
    return
  }
  const inserted = await db
    .insert(maintenanceTable)
    .values(toInsert)
    .returning({ id: maintenanceTable.id })
  const doneCount = toInsert.filter(r => r.status === "done").length
  console.log(
    `inserted ${String(inserted.length)} maintenance items (${String(doneCount)} done)`,
  )
}

type SeedEquipment = {
  name: string
  building_name: string
  category?: string
  notes?: string
}

const SEED_EQUIPMENT: SeedEquipment[] = [
  { name: "Wood stove", building_name: "Furua", category: "heating" },
  { name: "Heat pump", building_name: "Nybygget", category: "heating" },
  { name: "Refrigerator", building_name: "Furua", category: "appliance" },
  { name: "Dishwasher", building_name: "Furua", category: "appliance" },
  { name: "Washing machine", building_name: "Nybygget", category: "appliance" },
  { name: "Outboard motor", building_name: "Naustet", category: "boat" },
  { name: "Rowing boat", building_name: "Naustet", category: "boat" },
  { name: "Lawn mower", building_name: "Kabelpalasset", category: "tool" },
  { name: "Chainsaw", building_name: "Kabelpalasset", category: "tool" },
  { name: "Smoke detector", building_name: "Slabeslottet", category: "safety" },
]

type SeedContact = {
  name: string
  phone?: string | null
  email?: string | null
  info?: string | null
}

const SEED_CONTACTS: SeedContact[] = [
  {
    name: "Landowner",
    phone: "+47 900 00 001",
    email: "landowner@example.local",
    info: "Owns the land the property sits on.",
  },
  {
    name: "Neighbour",
    phone: "+47 900 00 002",
    email: null,
    info: "Closest neighbour, holds a spare key.",
  },
  {
    name: "Marina",
    phone: "+47 900 00 003",
    email: "marina@example.local",
    info: "Boat slip rental and fuel.",
  },
  {
    name: "Baker",
    phone: "+47 900 00 004",
    email: null,
    info: "Fresh bread mornings.",
  },
]

async function seedContacts(property_id: number) {
  const existing = await db
    .select({ name: propertyContactsTable.name })
    .from(propertyContactsTable)
    .where(eq(propertyContactsTable.property_id, property_id))
  const have = new Set(existing.map(r => r.name))
  const rows = SEED_CONTACTS.filter(c => !have.has(c.name)).map(c => ({
    property_id,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    info: c.info ?? null,
  }))
  if (rows.length === 0) {
    console.log(`found ${String(existing.length)} property contacts, skipping seed`)
    return
  }
  const inserted = await db
    .insert(propertyContactsTable)
    .values(rows)
    .returning({ id: propertyContactsTable.id })
  console.log(`inserted ${String(inserted.length)} property contacts`)
}

async function seedEquipment(
  property_id: number,
  buildingsByName: Map<string, number>,
) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(equipmentTable)
  if (count >= SEED_EQUIPMENT.length) {
    console.log(`found ${String(count)} equipment items, skipping seed`)
    return
  }
  const rows: (typeof equipmentTable.$inferInsert)[] = []
  for (const seed of SEED_EQUIPMENT) {
    const building_id = buildingsByName.get(seed.building_name)
    if (building_id === undefined) {
      throw new Error(
        `seed equipment "${seed.name}" references unknown building "${seed.building_name}"`,
      )
    }
    rows.push({
      name: seed.name,
      property_id,
      building_id,
      category: seed.category ?? null,
      notes: seed.notes ?? null,
    })
  }
  const inserted = await db
    .insert(equipmentTable)
    .values(rows)
    .returning({ id: equipmentTable.id })
  console.log(`inserted ${String(inserted.length)} equipment items`)
}

async function main() {
  const users = await Promise.all(SEED_USERS.map(upsertUser))
  const usersByName = new Map(users.map(u => [u.name, u]))
  const property = await upsertProperty()

  const buildingIds: number[] = []
  const buildingsByName = new Map<string, number>()
  for (const seedBuilding of SEED_BUILDINGS) {
    const building = await upsertBuilding(property.id, seedBuilding.name)
    buildingIds.push(building.id)
    buildingsByName.set(building.name, building.id)
    for (const seedRoom of seedBuilding.rooms) {
      await upsertRoom(building.id, seedRoom)
    }
  }

  const groupMemberIds = new Map<number, number[]>()
  for (const seedGroup of SEED_USER_GROUPS) {
    const group = await upsertUserGroup(seedGroup)
    const ids: number[] = []
    for (const memberName of seedGroup.member_user_names) {
      const member = usersByName.get(memberName)
      if (!member) {
        throw new Error(
          `seed group "${seedGroup.name}" references unknown user "${memberName}"`,
        )
      }
      await upsertUserGroupMember(group.id, member.id)
      ids.push(member.id)
    }
    groupMemberIds.set(group.id, ids)
  }

  const ownerUsers = users.filter(u => u.is_admin || u.is_head)
  const evenPct = (100 / ownerUsers.length).toFixed(2)
  const owners = new Map<number, number>()
  for (const user of ownerUsers) {
    const owner = await upsertOwner(property.id, user.id, evenPct)
    owners.set(user.id, owner.id)
  }

  const heads = users.filter(u => u.is_head)
  for (const [idx, head] of heads.entries()) {
    const week = PEAK_WEEKS[idx % PEAK_WEEKS.length]
    const ownerId = owners.get(head.id)
    if (ownerId === undefined || week === undefined) continue
    await upsertPriorityWeek(property.id, ownerId, SEED_PRIORITY_YEAR, week)
  }

  const payerIds = users
    .filter(u => !u.is_admin)
    .map(u => u.id)
  const reimburserIds = users.filter(u => u.is_head).map(u => u.id)
  await seedExpenses(payerIds, reimburserIds)

  await seedBookings(property.id, groupMemberIds)
  const nonAdminIds = users.filter(u => !u.is_admin).map(u => u.id)
  await seedMaintenance(buildingIds, nonAdminIds)
  await seedEquipment(property.id, buildingsByName)
  await seedContacts(property.id)

  console.log("\nseed complete.")
  console.log(`  property_id = ${String(property.id)}`)
  for (const u of users) {
    console.log(
      `  user #${String(u.id)} ${u.name} (admin=${String(u.is_admin)}, head=${String(u.is_head)})`,
    )
  }
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())