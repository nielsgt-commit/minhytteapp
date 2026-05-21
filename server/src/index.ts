import "dotenv/config"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { serve } from "@hono/node-server"
import { trpcServer } from "@hono/trpc-server"
import { appRouter } from "./trpc/routers/_app.ts"
import { createContext } from "./trpc/context.ts"
import { auth } from "./auth/auth.ts"

const app = new Hono()

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
)

app.get("/health", c => c.json({ ok: true }))

app.on(["POST", "GET"], "/api/auth/*", c => auth.handler(c.req.raw))

const isDev = process.env.NODE_ENV !== "production"

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
    onError: isDev
      ? ({ error, path, type }) => {
          console.error(
            `[trpc] ${type} ${path ?? "<unknown>"} →`,
            error.cause ?? error,
          )
        }
      : undefined,
  }),
)

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: "internal" }, 500)
})

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${String(port)}`)
})
