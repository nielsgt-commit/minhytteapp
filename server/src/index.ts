import "./env.ts"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { trpcServer } from "@hono/trpc-server"
import { appRouter } from "./trpc/routers/_app.ts"
import { createContext } from "./trpc/context.ts"
import { auth } from "./auth/auth.ts"
import { pool } from "./db/client.ts"
import { imagesRoute } from "./routes/images.ts"

const app = new Hono()

// Hono's default headers (X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy, Strict-Transport-Security, Cross-Origin-*-Policy, …).
// CSP is intentionally not configured here — it's opt-in and the strict
// default would block the PWA's workbox runtime and designsystemet inline
// styles. Enable it as a focused follow-up after auditing allowances.
app.use("*", secureHeaders())

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
)

// Liveness — cheap, no DB. /ready is the deeper probe Render polls.
app.get("/health", c => c.json({ ok: true }))

app.get("/ready", async c => {
  try {
    await pool.query("SELECT 1")
    return c.json({ ok: true })
  } catch {
    return c.json({ ok: false, db: "unreachable" }, 503)
  }
})

// Canonical-host redirect. The app is reachable on both the apex and the
// www. host, but cookies/sessions are host-scoped, so split hosts mean a
// user logged in on one isn't logged in on the other (and was the original
// cause of logout silently failing via a cross-origin 403). Force a single
// canonical host derived from BETTER_AUTH_URL — the same host magic links
// and auth cookies already use. Registered *after* /health and /ready so
// Render's health probes (which hit the service on its internal host) are
// served directly and never receive a 301.
const canonicalUrl = (() => {
  try {
    return new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:5173")
  } catch {
    return undefined
  }
})()

if (process.env.NODE_ENV === "production" && canonicalUrl) {
  app.use("*", async (c, next) => {
    const host = c.req.header("host")
    if (host && host !== canonicalUrl.host) {
      const target = new URL(c.req.url)
      target.protocol = canonicalUrl.protocol
      target.host = canonicalUrl.host
      return c.redirect(target.toString(), 301)
    }
    await next()
  })
}

app.on(["POST", "GET"], "/api/auth/*", c => auth.handler(c.req.raw))

app.route("/api/images", imagesRoute)

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

// In production this process also serves the built SPA.
// Locally Vite serves the client on :5173 and proxies /api here.
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./client/dist" }))
  app.get("*", serveStatic({ path: "./client/dist/index.html" }))
}

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: "internal" }, 500)
})

const port = Number(process.env.PORT ?? 3001)
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${String(port)}`)
})

// Render sends SIGTERM on every restart/deploy. SIGINT is for local Ctrl-C.
// Both: stop accepting new connections, let in-flight requests finish, drain
// the pg pool, exit. Safety-net force-exit after 10s if drain hangs.
const shutdown = (signal: string) => {
  console.log(`[shutdown] received ${signal}, draining`)
  server.close(() => {
    pool
      .end()
      .catch((err: unknown) => {
        console.error("[shutdown] pool.end() failed:", err)
      })
      .finally(() => {
        console.log("[shutdown] pool drained, exiting")
        process.exit(0)
      })
  })
  setTimeout(() => {
    console.error("[shutdown] forced exit after 10s")
    process.exit(1)
  }, 10_000).unref()
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM")
})
process.on("SIGINT", () => {
  shutdown("SIGINT")
})
