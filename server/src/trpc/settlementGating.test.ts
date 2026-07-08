import { afterAll, describe, expect, it } from "vitest"
import { db, pool } from "../db/client.ts"
import {
  propertyOwnersTable,
  propertyTable,
} from "../db/schema/property.schema.ts"
import {
  propertySplitPoliciesTable,
  settlementsTable,
} from "../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../db/schema/users.schema.ts"
import type { SplitPolicyConfig } from "../shared/splitPolicy.ts"
import { Temporal } from "../shared/temporal.ts"
import type { AuthUser, Context } from "./context.ts"
import { createCallerFactory } from "./init.ts"
import { appRouter } from "./routers/_app.ts"

// A settlement linked to a policy whose parameters exclude booking_days must
// skip the collecting_bookings phase and compute its preview with zero
// booking data; settlements without a custom policy keep the legacy chain.

const createCaller = createCallerFactory(appRouter)

function authUser(row: { id: number; name: string; email: string }): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: true,
    image: null,
    is_admin: false,
    is_head_anywhere: false,
    is_head: false,
    is_child: false,
    parent_user_id: null,
    birthday: null,
    onboarding_step: null,
    onboarding_dismissed_at: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function ctxFor(tx: Tx, user: AuthUser): Context {
  return { db: tx, session: null, user } as unknown as Context
}

const OWNERSHIP_ONLY_CONFIG: SplitPolicyConfig = {
  parameters: ["ownership"],
  rules: [],
  fallback: {
    how: { kind: "by_ownership_pct" },
    who: [{ kind: "main_groups" }],
    except: [],
    when: { kind: "always" },
  },
}

async function seed(tx: Tx, config: SplitPolicyConfig | null) {
  const [prop] = await tx
    .insert(propertyTable)
    .values({ name: "Gating Prop", address: "addr" })
    .returning()
  const [head] = await tx
    .insert(usersTable)
    .values({ name: "Head", email: "gating-test-head@example.test" })
    .returning()
  const [group] = await tx
    .insert(userGroupsTable)
    .values({ name: "Fam", is_family: true, property_id: prop.id })
    .returning()
  await tx
    .insert(userGroupMembersTable)
    .values({ user_group_id: group.id, user_id: head.id, is_head: true })
  await tx.insert(propertyOwnersTable).values({
    property_id: prop.id,
    user_group_id: group.id,
    ownership_pct: "100.00",
  })
  let policyId: number | null = null
  if (config != null) {
    const [policy] = await tx
      .insert(propertySplitPoliciesTable)
      .values({
        property_id: prop.id,
        name: "Ownership only",
        config,
        created_by_id: head.id,
      })
      .returning()
    policyId = policy.id
  }
  const [settlement] = await tx
    .insert(settlementsTable)
    .values({
      property_id: prop.id,
      year: 2026,
      status: "open",
      split_policy: "occupancy_days",
      split_policy_id: policyId,
      created_by_id: head.id,
    })
    .returning()
  return { prop, head, group, settlement }
}

class Rollback extends Error {}

async function withRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(async tx => {
      await fn(tx)
      throw new Rollback()
    })
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
  }
}

afterAll(async () => {
  await pool.end()
})

describe("policy-driven phase gating", () => {
  it("skips collecting_bookings when the policy has no booking_days", async () => {
    await withRollback(async tx => {
      const { head, settlement } = await seed(tx, OWNERSHIP_ONLY_CONFIG)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      await expect(
        caller.settlement.advancePhase({
          id: settlement.id,
          from: "collecting_expenses",
          to: "collecting_bookings",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const advanced = await caller.settlement.advancePhase({
        id: settlement.id,
        from: "collecting_expenses",
        to: "reviewing",
      })
      expect(advanced.phase).toBe("reviewing")
      const regressed = await caller.settlement.regressPhase({
        id: settlement.id,
        from: "reviewing",
        to: "collecting_expenses",
      })
      expect(regressed.phase).toBe("collecting_expenses")
    })
  })

  it("links heads' submitted expenses to the settlement when entering review", async () => {
    await withRollback(async tx => {
      const { prop, head, settlement } = await seed(tx, OWNERSHIP_ONLY_CONFIG)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      const aDate = Temporal.PlainDate.from("2026-05-01")
      const submitted = await caller.expense.create({
        property_id: prop.id,
        amount: 300,
        date: aDate,
        status: "submitted",
      })
      const draft = await caller.expense.create({
        property_id: prop.id,
        amount: 200,
        date: aDate,
        status: "draft",
      })
      await caller.settlement.advancePhase({
        id: settlement.id,
        from: "collecting_expenses",
        to: "reviewing",
      })
      const expenses = await caller.expense.listForProperty({
        property_id: prop.id,
      })
      expect(expenses.find(e => e.id === submitted.id)?.settlement_id).toBe(
        settlement.id,
      )
      expect(expenses.find(e => e.id === draft.id)?.settlement_id).toBeNull()
    })
  })

  it("keeps the full chain without a custom policy", async () => {
    await withRollback(async tx => {
      const { head, settlement } = await seed(tx, null)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      await expect(
        caller.settlement.advancePhase({
          id: settlement.id,
          from: "collecting_expenses",
          to: "reviewing",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const advanced = await caller.settlement.advancePhase({
        id: settlement.id,
        from: "collecting_expenses",
        to: "collecting_bookings",
      })
      expect(advanced.phase).toBe("collecting_bookings")
    })
  })
})

describe("previewSplit dispatch", () => {
  it("computes a custom no-bookings policy with zero booking data", async () => {
    await withRollback(async tx => {
      const { head, settlement } = await seed(tx, OWNERSHIP_ONLY_CONFIG)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      const preview = await caller.settlement.previewSplit({
        id: settlement.id,
      })
      expect(preview.policy).toBe("custom")
      expect(preview.policy_name).toBe("Ownership only")
      expect(preview.parameters).toEqual(["ownership"])
      expect(preview.inputs.total_booking_days).toBeNull()
      expect(preview.groups).toHaveLength(1)
      expect(preview.groups[0].booking_days).toBeNull()
    })
  })

  it("keeps the legacy occupancy preview without a custom policy", async () => {
    await withRollback(async tx => {
      const { head, settlement } = await seed(tx, null)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      const preview = await caller.settlement.previewSplit({
        id: settlement.id,
      })
      expect(preview.policy).toBe("occupancy_days")
      expect(preview.inputs.total_booking_days).toBe(0)
    })
  })
})

describe("propertySplitPolicy.save parameter validation", () => {
  it("rejects a config whose rules need a disabled parameter", async () => {
    await withRollback(async tx => {
      const { prop, head } = await seed(tx, null)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      await expect(
        caller.propertySplitPolicy.save({
          property_id: prop.id,
          name: "Inconsistent",
          config: {
            parameters: ["ownership"],
            rules: [],
            fallback: {
              how: { kind: "weighted_by_occupancy" },
              who: [{ kind: "main_groups" }],
              except: [],
              when: { kind: "always" },
            },
          },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })
})

describe("propertySplitPolicy.updateOccupancy", () => {
  it("persists only the occupancy, leaving rules and fallback intact", async () => {
    await withRollback(async tx => {
      const config: SplitPolicyConfig = {
        parameters: ["booking_days", "time_conditions"],
        rules: [],
        fallback: {
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "main_groups" }],
          except: [],
          when: { kind: "always" },
        },
        occupancy: {
          window: { kind: "year" },
          include_extra_guests: false,
          child_weight: 1,
        },
      }
      const { prop, head } = await seed(tx, config)
      const caller = createCaller(ctxFor(tx, authUser(head)))
      const [policy] = await caller.propertySplitPolicy.listForProperty({
        property_id: prop.id,
      })
      await caller.propertySplitPolicy.updateOccupancy({
        id: policy.id,
        property_id: prop.id,
        occupancy: {
          window: { kind: "year" },
          include_extra_guests: true,
          child_weight: 0.5,
        },
      })
      const [updated] = await caller.propertySplitPolicy.listForProperty({
        property_id: prop.id,
      })
      expect(updated.config.occupancy).toEqual({
        window: { kind: "year" },
        include_extra_guests: true,
        child_weight: 0.5,
      })
      expect(updated.config.fallback.how).toEqual({
        kind: "weighted_by_occupancy",
      })
    })
  })
})
