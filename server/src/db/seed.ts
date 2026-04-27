import "dotenv/config"
import { and, eq, isNull } from "drizzle-orm"
import { db, pool } from "./client.ts"
import {
  buildingsTable,
  propertyOwnersTable,
  propertyPriorityWeeksTable,
  propertyTable,
  roomTable,
} from "./schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "./schema/users.schema.ts"

type SeedUser = {
  name: string
  is_admin?: boolean
  is_head?: boolean
  pending?: boolean
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
  { name: "Sofie", pending: true },
  { name: "Ardis", pending: true },
  { name: "Anita", pending: true },
  { name: "Rasmus", pending: true },
  { name: "Peik", pending: true },
  { name: "Jørgen", pending: true },
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

async function upsertUser(seed: SeedUser) {
  const oauth_sub = seed.pending ? null : seed.name
  const email = seed.pending
    ? `pending-${seed.name}@example.local`
    : `${seed.name}@oauth.local`
  const existing = (
    await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1)
  ).at(0)
  if (existing) {
    console.log(`found user #${String(existing.id)} (${existing.email})`)
    return existing
  }
  const created = (
    await db
      .insert(usersTable)
      .values({
        name: seed.name,
        email,
        oauth_sub,
        is_admin: seed.is_admin ?? false,
        is_head: seed.is_head ?? false,
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

async function main() {
  const users = await Promise.all(SEED_USERS.map(upsertUser))
  const usersByName = new Map(users.map(u => [u.name, u]))
  const property = await upsertProperty()

  for (const seedBuilding of SEED_BUILDINGS) {
    const building = await upsertBuilding(property.id, seedBuilding.name)
    for (const seedRoom of seedBuilding.rooms) {
      await upsertRoom(building.id, seedRoom)
    }
  }

  for (const seedGroup of SEED_USER_GROUPS) {
    const group = await upsertUserGroup(seedGroup)
    for (const memberName of seedGroup.member_user_names) {
      const member = usersByName.get(memberName)
      if (!member) {
        throw new Error(
          `seed group "${seedGroup.name}" references unknown user "${memberName}"`,
        )
      }
      await upsertUserGroupMember(group.id, member.id)
    }
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