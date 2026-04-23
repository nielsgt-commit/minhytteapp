import "dotenv/config"
import express, { type ErrorRequestHandler } from "express"
import cors from "cors"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import { appRouter } from "./trpc/routers/_app.ts"
import { createContext } from "./trpc/context.ts"

const app = express()

app.use(cors())
app.use(express.json())

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

const isDev = process.env.NODE_ENV !== "production"

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: isDev
      ? ({ error, path, type }) => {
          console.error(`[trpc] ${type} ${path ?? "<unknown>"} →`, error.cause ?? error)
        }
      : undefined,
  }),
)

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: "internal" })
}
app.use(errorHandler)

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})