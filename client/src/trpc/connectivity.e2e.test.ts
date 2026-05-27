// @vitest-environment node
import { describe, expect, test } from "vitest"

const API_URL =
  process.env.VITE_TEST_API_URL ?? "http://localhost:3001/api/trpc"
const HEALTH_URL =
  process.env.VITE_TEST_HEALTH_URL ?? "http://localhost:3001/health"

describe("front end ↔ back end reachability", () => {
  test("health endpoint", async () => {
    const res = await fetch(HEALTH_URL)
    expect(res.ok).toBe(true)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  // Authenticated reachability is exercised by the per-router tests; the
  // previous unauthenticated *.list endpoints were removed as part of the
  // tRPC lockdown.
  test("trpc base url responds", async () => {
    const res = await fetch(API_URL.replace(/\/trpc$/, "/health"))
    expect(res.ok).toBe(true)
  })
})
