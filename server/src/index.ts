import "dotenv/config"
import express, { type ErrorRequestHandler } from "express"
import cors from "cors"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import { usersRouter } from "./routes/users.ts"
import { appRouter } from "./trpc/routers/_app.ts"
import { createContext } from "./trpc/context.ts"

const app = express()

app.use(cors())
app.use(express.json())

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.use("/api/users", usersRouter)
app.use(
  "/api/trpc",
  createExpressMiddleware({ router: appRouter, createContext }),
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