import "../env.ts"
import { eq } from "drizzle-orm"
import { db, pool } from "./client.ts"
import { allowedEmailsTable, usersTable } from "./schema/users.schema.ts"

const ADMIN_NAME = "Admin"
const ADMIN_EMAIL = "admin@oauth.local"

async function main() {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL))
    .limit(1)

  let admin_id: number
  if (existing.length > 0) {
    admin_id = existing[0].id
    console.log(`found existing admin user #${String(admin_id)} (${ADMIN_EMAIL})`)
  } else {
    const [inserted] = await db
      .insert(usersTable)
      .values({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        email_verified: true,
        is_admin: true,
      })
      .returning({ id: usersTable.id })
    admin_id = inserted.id
    console.log(`inserted admin user #${String(admin_id)} (${ADMIN_EMAIL})`)
  }

  const existingAllowed = await db
    .select({ id: allowedEmailsTable.id })
    .from(allowedEmailsTable)
    .where(eq(allowedEmailsTable.email, ADMIN_EMAIL))
    .limit(1)

  if (existingAllowed.length > 0) {
    console.log(`allowed-list entry already exists for ${ADMIN_EMAIL}`)
  } else {
    await db.insert(allowedEmailsTable).values({
      email: ADMIN_EMAIL,
      added_by_user_id: admin_id,
    })
    console.log(`inserted allowed-list entry for ${ADMIN_EMAIL}`)
  }

  console.log("minimal seed complete.")
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
