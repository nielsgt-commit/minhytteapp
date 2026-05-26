import "dotenv/config"
import { eq, isNull, or } from "drizzle-orm"
import { db, pool } from "../db/client.ts"
import { propertyTable } from "../db/schema/property.schema.ts"
import { geocodeNorwayAddress } from "../services/geocode.ts"

async function main() {
  const targets = await db
    .select({
      id: propertyTable.id,
      name: propertyTable.name,
      address: propertyTable.address,
    })
    .from(propertyTable)
    .where(or(isNull(propertyTable.latitude), isNull(propertyTable.longitude)))

  if (targets.length === 0) {
    console.log("All properties already have coordinates.")
    return
  }

  for (const p of targets) {
    process.stdout.write(`#${String(p.id)} ${p.name} (${p.address}) … `)
    const coords = await geocodeNorwayAddress(p.address)
    if (!coords) {
      console.log("no match")
      continue
    }
    await db.update(propertyTable).set(coords).where(eq(propertyTable.id, p.id))
    console.log(`${coords.latitude}, ${coords.longitude}`)
  }
}

main()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
