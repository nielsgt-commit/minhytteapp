import "dotenv/config"
import { eq } from "drizzle-orm"
import { db, pool } from "./client.ts"
import { propertyTable } from "./schema/property.schema.ts"
import { usersTable } from "./schema/users.schema.ts"

async function main() {
  const existingUser = (
    await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "owner@example.com"))
      .limit(1)
  ).at(0)
  let user = existingUser
  if (!user) {
    const created = (
      await db
        .insert(usersTable)
        .values({
          name: "Owner",
          email: "owner@example.com",
          oauth_sub: "Owner",
          is_admin: true,
        })
        .returning()
    ).at(0)
    if (!created) throw new Error("failed to insert user")
    user = created
  } else if (!user.oauth_sub) {
    const updated = (
      await db
        .update(usersTable)
        .set({ oauth_sub: "Owner" })
        .where(eq(usersTable.id, user.id))
        .returning()
    ).at(0)
    if (updated) user = updated
  }
  console.log(
    `${existingUser ? "found" : "inserted"} user #${String(user.id)} (${user.email})`,
  )

  const existingMember = (
    await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "member@example.com"))
      .limit(1)
  ).at(0)
  let member = existingMember
  if (!member) {
    const created = (
      await db
        .insert(usersTable)
        .values({
          name: "Member",
          email: "member@example.com",
          oauth_sub: "Member",
          is_admin: false,
        })
        .returning()
    ).at(0)
    if (!created) throw new Error("failed to insert member user")
    member = created
  }
  console.log(
    `${existingMember ? "found" : "inserted"} member #${String(member.id)} (${member.email})`,
  )

  const existingProperty = (
    await db.select().from(propertyTable).limit(1)
  ).at(0)
  let property = existingProperty
  if (!property) {
    const created = (
      await db
        .insert(propertyTable)
        .values({ name: "Hytta", address: "Fjellveien 1" })
        .returning()
    ).at(0)
    if (!created) throw new Error("failed to insert property")
    property = created
  }
  console.log(
    `${existingProperty ? "found" : "inserted"} property #${String(property.id)} (${property.name})`,
  )

  console.log("\nseed complete.")
  console.log(`  property_id = ${String(property.id)}`)
  console.log(`  booker_id   = ${String(user.id)}`)
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())