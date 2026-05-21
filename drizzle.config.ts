import dotenv from "dotenv"
dotenv.config({
  path: `.env.${process.env.NODE_ENV ?? "development"}`,
})
import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

export default defineConfig({
  out: "./drizzle",
  schema: "./server/src/db/schema/*",
  dialect: "postgresql",
  dbCredentials: { url },
})
