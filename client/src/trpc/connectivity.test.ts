// @vitest-environment node
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { beforeAll, describe, expect, test } from "vitest"
import type { AppRouter } from "@server/trpc/routers/_app.ts"

const API_URL =
  process.env.VITE_TEST_API_URL ?? "http://localhost:3001/api/trpc"
const HEALTH_URL =
  process.env.VITE_TEST_HEALTH_URL ?? "http://localhost:3001/health"

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: API_URL })],
})

describe("front end ↔ back end reachability", () => {
  beforeAll(async () => {
    const res = await fetch(HEALTH_URL)
    const body = (await res.json()) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(body.ok).toBe(true)
  })

  test("booking.list", async () => {
    const rows = await client.booking.list.query()
    console.log("booking.list ->", rows)
    expect(Array.isArray(rows)).toBe(true)
  })

  test("expense.list", async () => {
    const rows = await client.expense.list.query()
    console.log("expense.list ->", rows)
    expect(Array.isArray(rows)).toBe(true)
  })

  test("maintenance.list", async () => {
    const rows = await client.maintenance.list.query()
    console.log("maintenance.list ->", rows)
    expect(Array.isArray(rows)).toBe(true)
  })

  test("settlement.list", async () => {
    const rows = await client.settlement.list.query()
    console.log("settlement.list ->", rows)
    expect(Array.isArray(rows)).toBe(true)
  })

  test("dashboard.summary", async () => {
    const summary = await client.dashboard.summary.query()
    console.log("dashboard.summary ->", summary)
    expect(summary).toEqual(
      expect.objectContaining({
        expenseCount: expect.any(Number),
        totalSpent: expect.any(Number),
        upcomingBookings: expect.any(Number),
        openMaintenance: expect.any(Number),
      }),
    )
  })
})