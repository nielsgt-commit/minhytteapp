// @vitest-environment node
import { describe, expect, test } from "vitest"
import type { AppRouter } from "@server/trpc/routers/_app.ts"

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

  test("trpc base url responds", async () => {
    const res = await fetch(API_URL.replace(/\/api\/trpc$/, "/health"))
    expect(res.ok).toBe(true)
  })
})

// Every procedure requires auth since the tRPC lockdown, so reachability is
// probed unauthenticated: a MOUNTED procedure answers with a tRPC error
// envelope (UNAUTHORIZED / BAD_REQUEST), while an unmounted router or a
// renamed procedure answers NOT_FOUND — which fails the probe. The map is
// keyed by every router on AppRouter, so mounting a new router without
// adding a probe (or renaming one) stops this file from type-checking.
type RouterName = keyof AppRouter["_def"]["record"]

const PROBES: Record<RouterName, string> = {
  allowedEmail: "list",
  booking: "listForProperty",
  dinner: "listForProperty",
  equipment: "listForProperty",
  equipmentCategory: "list",
  event: "list",
  expense: "listForProperty",
  expenseCategory: "list",
  infrastructure: "listForProperty",
  inspection: "listForProperty",
  inventoryItem: "listForProperty",
  maintenance: "listForProperty",
  parking: "listForProperty",
  priority: "list",
  procedureStep: "listForProperty",
  property: "mine",
  propertyContact: "listForProperty",
  propertyOwner: "list",
  propertySplitPolicy: "listForProperty",
  room: "listForProperty",
  season: "list",
  settlement: "listForProperty",
  shoppingItem: "listForProperty",
  stay: "atProperty",
  structure: "listForProperty",
  todo: "listForProperty",
  user: "listForProperty",
  userGroup: "listWithMembersForProperty",
  weather: "forProperty",
}

// The superjson transformer wraps the envelope: error.json.data.code.
type TrpcErrorEnvelope = {
  error?: { json?: { data?: { code?: string } } }
}

describe("every router is mounted", () => {
  for (const [router, procedure] of Object.entries(PROBES)) {
    test(`${router}.${procedure}`, async () => {
      const res = await fetch(`${API_URL}/${router}.${procedure}`)
      const body = (await res.json()) as TrpcErrorEnvelope
      // Auth (or input validation) rejecting proves the procedure exists;
      // only "no procedure found on path" may answer NOT_FOUND.
      const code = body.error?.json?.data?.code
      expect(code).toBeDefined()
      expect(code).not.toBe("NOT_FOUND")
    })
  }
})
