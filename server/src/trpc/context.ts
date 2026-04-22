import type { CreateExpressContextOptions } from "@trpc/server/adapters/express"
import { db } from "../db/client.ts"

export const createContext = ({ req }: CreateExpressContextOptions) => ({
  db,
  authHeader: req.header("authorization") ?? null,
})

export type Context = Awaited<ReturnType<typeof createContext>>