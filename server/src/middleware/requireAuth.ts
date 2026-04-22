import type { RequestHandler } from "express"

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.header("authorization")) {
    res.status(401).json({ error: "unauthorized" })
    return
  }
  next()
}