// Service-level tests for the settlement phase machinery. The phase
// transitions themselves (validation, CONFLICT races, expense pull) are
// characterized end-to-end in trpc/routers/settlement.test.ts; this file
// covers the pure lookups that feed them.

import { afterAll, describe, expect, it } from "vitest"
import { pool } from "../db/client.ts"
import {
  propertyOwnersTable,
  propertyTable,
} from "../db/schema/property.schema.ts"
import { propertySplitPoliciesTable } from "../db/schema/settlement.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../db/schema/users.schema.ts"
import {
  SPLIT_POLICY_PARAMETERS,
  normalizeParameters,
} from "../shared/splitPolicy.ts"
import type { Tx } from "../trpc/test-utils.ts"
import { dbFor, withRollback } from "../trpc/test-utils.ts"
import {
  listSettlementHeads,
  resolveSettlementParameters,
} from "./settlementPhase.ts"

afterAll(async () => {
  await pool.end()
})

async function seedProperty(tx: Tx) {
  const [prop] = await tx
    .insert(propertyTable)
    .values({ name: "Phase Service Prop", address: "addr" })
    .returning()
  return prop
}

describe("resolveSettlementParameters", () => {
  it("returns every parameter without a policy or for an unknown policy id", async () => {
    await withRollback(async tx => {
      expect(await resolveSettlementParameters(dbFor(tx), null)).toEqual([
        ...SPLIT_POLICY_PARAMETERS,
      ])
      expect(await resolveSettlementParameters(dbFor(tx), 999_999_999)).toEqual(
        [...SPLIT_POLICY_PARAMETERS],
      )
    })
  })

  it("returns the normalized subset of a real policy", async () => {
    await withRollback(async tx => {
      const prop = await seedProperty(tx)
      const [creator] = await tx
        .insert(usersTable)
        .values({
          name: "Creator",
          email: "phase-service-creator@example.test",
        })
        .returning()
      const [policy] = await tx
        .insert(propertySplitPoliciesTable)
        .values({
          property_id: prop.id,
          name: "Ownership only",
          config: {
            parameters: ["ownership"],
            rules: [],
            fallback: {
              how: { kind: "by_ownership_pct" },
              who: [{ kind: "main_groups" }],
              except: [],
              when: { kind: "always" },
            },
          },
          created_by_id: creator.id,
        })
        .returning()
      const parameters = await resolveSettlementParameters(dbFor(tx), policy.id)
      expect(parameters).toEqual(normalizeParameters(["ownership"]))
      expect(parameters).not.toContain("booking_days")
    })
  })
})

describe("listSettlementHeads", () => {
  it("returns only head members of this property's family groups", async () => {
    await withRollback(async tx => {
      const prop = await seedProperty(tx)
      const [otherProp] = await tx
        .insert(propertyTable)
        .values({ name: "Phase Service Other", address: "addr2" })
        .returning()
      const users = await tx
        .insert(usersTable)
        .values([
          { name: "Family Head", email: "phase-service-head@example.test" },
          { name: "Plain Member", email: "phase-service-member@example.test" },
          {
            name: "Owners-Group Head",
            email: "phase-service-owners-head@example.test",
          },
          {
            name: "Other Property Head",
            email: "phase-service-other-head@example.test",
          },
        ])
        .returning()
      const [familyHead, plainMember, ownersHead, otherHead] = users
      const groups = await tx
        .insert(userGroupsTable)
        .values([
          { name: "Family", is_family: true, property_id: prop.id },
          { name: "Owners", is_family: false, property_id: prop.id },
          { name: "Other Family", is_family: true, property_id: otherProp.id },
        ])
        .returning()
      const [familyGroup, ownersGroup, otherGroup] = groups
      await tx.insert(userGroupMembersTable).values([
        {
          user_group_id: familyGroup.id,
          user_id: familyHead.id,
          is_head: true,
        },
        {
          user_group_id: familyGroup.id,
          user_id: plainMember.id,
          is_head: false,
        },
        // Head flag in a non-family group must not count.
        {
          user_group_id: ownersGroup.id,
          user_id: ownersHead.id,
          is_head: true,
        },
        // Head of another property's family group must not count.
        { user_group_id: otherGroup.id, user_id: otherHead.id, is_head: true },
      ])
      await tx.insert(propertyOwnersTable).values({
        property_id: prop.id,
        user_group_id: familyGroup.id,
        ownership_pct: "100.00",
      })

      const heads = await listSettlementHeads(dbFor(tx), prop.id)
      expect(heads).toEqual([
        { user_id: familyHead.id, user_name: "Family Head" },
      ])
    })
  })
})
