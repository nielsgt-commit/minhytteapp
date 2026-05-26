import dotenv from "dotenv"
// On Render the runtime env is injected directly; skip the file load so
// missing vars surface as real errors instead of being masked by the
// committed template's empty values.
if (!process.env.RENDER) {
  dotenv.config({
    path: `.env.${process.env.NODE_ENV ?? "development"}`,
  })
}
import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

export default defineConfig({
  out: "./drizzle",
  schema: "./server/src/db/schema/*",
  dialect: "postgresql",
  dbCredentials: { url },
})
