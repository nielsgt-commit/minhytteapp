import "dotenv/config"
import express, { type ErrorRequestHandler } from "express"
import cors from "cors"
import { usersRouter } from "./routes/users"

const app = express()

app.use(cors())
app.use(express.json())

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.use("/api/users", usersRouter)

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: "internal" })
}
app.use(errorHandler)

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})