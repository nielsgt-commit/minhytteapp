import { Router } from "express"
import { db } from "../db/client"
import { usersTable } from "../db/schema/users.schema.ts"
import { requireAuth } from "../middleware/requireAuth"

export const usersRouter: Router = Router()

usersRouter.get("/", async (_req, res) => {
  const users = await db.select().from(usersTable)
  res.json(users)
})

usersRouter.post("/", requireAuth, async (req, res) => {
  const [created] = await db
    .insert(usersTable)
    .values(req.body)
    .returning()
  res.status(201).json(created)
})