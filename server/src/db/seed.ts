import "dotenv/config"
import { and, eq, isNull } from "drizzle-orm"
import { db, pool } from "./client.ts"
import {
  propertyOwnersTable,
  propertyPriorityWeeksTable,
  propertyTable,
} from "./schema/property.schema.ts"
import { usersTable } from "./schema/users.schema.ts"

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
]

const SEED_PROPERTY = { name: "Furua", address: "—" }

const PEAK_WEEKS = [28, 29, 30] as const
const SEED_PRIORITY_YEAR = new Date().getUTCFullYear()

async function upsertUser(seed: SeedUser) {
  const oauth_sub = seed.name
  const email = `${seed.name}@oauth.local`
  const existing = (
    await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.oauth_sub, oauth_sub))
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
  const property = await upsertProperty()

  const evenPct = (100 / users.length).toFixed(2)
  const owners = new Map<number, number>()
  for (const user of users) {
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