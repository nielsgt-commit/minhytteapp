import "dotenv/config"
import { eq } from "drizzle-orm"
import { db, pool } from "./client.ts"
import { propertyTable } from "./schema/property.schema.ts"
import { usersTable } from "./schema/users.schema.ts"

async function main() {
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "owner@example.com"))
    .limit(1)
  const user =
    existingUser ??
    (await db
      .insert(usersTable)
      .values({
        name: "Owner",
        date_of_birth: 19800101,
        email: "owner@example.com",
      })
      .returning()
      .then((r) => r[0]))
  console.log(
    `${existingUser ? "found" : "inserted"} user #${user.id} (${user.email})`,
  )

  const [existingProperty] = await db.select().from(propertyTable).limit(1)
  const property =
    existingProperty ??
    (await db
      .insert(propertyTable)
      .values({ name: "Hytta", address: "Fjellveien 1" })
      .returning()
      .then((r) => r[0]))
  console.log(
    `${existingProperty ? "found" : "inserted"} property #${property.id} (${property.name})`,
  )

  console.log("\nseed complete.")
  console.log(`  property_id = ${property.id}`)
  console.log(`  booker_id   = ${user.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())