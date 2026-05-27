import dotenv from "dotenv"
import { z } from "zod"

// On Render the runtime env is injected directly; loading a committed
// .env.production template (which has empty placeholders) would silently
// mask missing-var errors. Render sets RENDER=true automatically.
if (!process.env.RENDER) {
  dotenv.config({
    path: `.env.${process.env.NODE_ENV ?? "development"}`,
  })
}

const isProd = process.env.NODE_ENV === "production"

const req = <T extends z.ZodType>(
  s: T,
  devDefault?: Exclude<z.output<T>, undefined>,
) =>
  isProd ? s : devDefault === undefined ? s.optional() : s.default(devDefault)

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: req(z.url(), "http://localhost:5173"),
  CORS_ORIGIN: req(z.url(), "http://localhost:5173"),
  RESEND_API_KEY: req(z.string().min(1)),
  MAGIC_LINK_FROM: req(z.email()),
  MET_USER_AGENT: z
    .string()
    .default("minhytteapp/1.0 github.com/nielsgt-commit/minhytteapp"),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error("[env] invalid configuration:", z.treeifyError(parsed.error))
  throw new Error("Environment validation failed")
}

export const env = parsed.data
