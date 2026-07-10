// Characterization tests for the inspection lifecycle: start (cadence
// normalization + priority-group validation), complete (finding processing —
// followup todos, new steps, pinned ad-hocs — and the wrong-state /
// cross-location guards), record (one-shot completed inspection), and delete
// (unlinks findings instead of orphaning them).

import { afterAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { pool } from "../../db/client.ts"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceTable,
  procedureStepsTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  propertyTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "../../db/schema/users.schema.ts"
import { createCallerFactory } from "../init.ts"
import type { Tx } from "../test-utils.ts"
import { authUser, ctxFor, withRollback } from "../test-utils.ts"
import { appRouter } from "./_app.ts"

const createCaller = createCallerFactory(appRouter)

// One property with a member, a structure and a piece of equipment to inspect,
// plus a family group (for priority_week cadences). The second property holds
// a foreign structure/group that must stay unreachable across the boundary.
async function seed(tx: Tx) {
  const [prop, otherProp] = await tx
    .insert(propertyTable)
    .values([
      { name: "Inspection Test Prop", address: "addr" },
      { name: "Inspection Test Other Prop", address: "addr2" },
    ])
    .returning()
  const [member, outsider] = await tx
    .insert(usersTable)
    .values([
      { name: "Member", email: "inspection-test-member@example.test" },
      { name: "Outsider", email: "inspection-test-outsider@example.test" },
    ])
    .returning()
  const [group, foreignGroup] = await tx
    .insert(userGroupsTable)
    .values([
      { name: "Insp Fam", is_family: true, property_id: prop.id },
      { name: "Foreign Fam", is_family: true, property_id: otherProp.id },
    ])
    .returning()
  await tx.insert(userGroupMembersTable).values({
    user_group_id: group.id,
    user_id: member.id,
    is_head: false,
  })
  const [structure, foreignStructure] = await tx
    .insert(structuresTable)
    .values([
      { name: "Cabin", property_id: prop.id },
      { name: "Foreign Cabin", property_id: otherProp.id },
    ])
    .returning()
  const [equipment] = await tx
    .insert(equipmentTable)
    .values({ name: "Pump", property_id: prop.id })
    .returning()
  return {
    prop,
    member,
    outsider,
    group,
    foreignGroup,
    structure,
    foreignStructure,
    equipment,
  }
}

async function seedStep(tx: Tx, structureId: number, userId: number) {
  const [step] = await tx
    .insert(procedureStepsTable)
    .values({
      description: "Check the roof",
      structure_id: structureId,
      added_by: userId,
    })
    .returning()
  return step
}

async function maintenanceFor(tx: Tx, inspectionId: number) {
  return tx
    .select()
    .from(maintenanceTable)
    .where(eq(maintenanceTable.inspection_id, inspectionId))
}

afterAll(async () => {
  await pool.end()
})

describe("start", () => {
  it("creates an open inspection and nulls a stray cadence group", async () => {
    await withRollback(async tx => {
      const { member, group, structure, equipment } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const inspection = await caller.inspection.start({
        structure_id: structure.id,
        inspected_by: "Member",
        recurrence: "spring",
        // Not a priority_week cadence, so this must be dropped (the DB CHECK
        // would reject it otherwise).
        cadence_priority_group_id: group.id,
      })
      expect(inspection).toMatchObject({
        structure_id: structure.id,
        started_by_user_id: member.id,
        recurrence: "spring",
        cadence_priority_group_id: null,
        completed_at: null,
      })

      // A priority_week cadence keeps its (validated) group.
      const priority = await caller.inspection.start({
        equipment_id: equipment.id,
        inspected_by: "Member",
        recurrence: "priority_week",
        cadence_priority_group_id: group.id,
      })
      expect(priority.cadence_priority_group_id).toBe(group.id)
    })
  })

  it("rejects non-members and a priority group from another property", async () => {
    await withRollback(async tx => {
      const { member, outsider, structure, foreignGroup } = await seed(tx)
      await expect(
        createCaller(ctxFor(tx, authUser(outsider))).inspection.start({
          structure_id: structure.id,
          inspected_by: "Outsider",
          recurrence: "spring",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })

      await expect(
        createCaller(ctxFor(tx, authUser(member))).inspection.start({
          structure_id: structure.id,
          inspected_by: "Member",
          recurrence: "priority_week",
          cadence_priority_group_id: foreignGroup.id,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "group is not a family group for this property",
      })
    })
  })
})

describe("complete", () => {
  it("applies all finding kinds and stamps completion", async () => {
    await withRollback(async tx => {
      const { member, structure } = await seed(tx)
      const step = await seedStep(tx, structure.id, member.id)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const inspection = await caller.inspection.start({
        structure_id: structure.id,
        inspected_by: "Member",
        recurrence: "fall",
      })

      const completed = await caller.inspection.complete({
        id: inspection.id,
        inspected_by: "Member",
        recurrence: "fall",
        findings: [
          { kind: "step_result", step_id: step.id, status: "ok" },
          {
            kind: "step_result",
            step_id: step.id,
            status: "followup",
            followup_description: "Fix the hinge",
          },
          {
            kind: "new_step",
            description: "Check the gutters",
            followup_description: "Clear the gutters",
          },
          { kind: "ad_hoc", description: "Pin me", pin: true },
          { kind: "ad_hoc", description: "Loose board", pin: false },
        ],
      })
      expect(completed.completed_at).not.toBeNull()

      // Steps added this inspection: the new_step and the pinned ad_hoc.
      const stepsAdded = await tx
        .select()
        .from(procedureStepsTable)
        .where(eq(procedureStepsTable.created_in_inspection_id, inspection.id))
      expect(stepsAdded.map(s => s.description).sort()).toEqual([
        "Check the gutters",
        "Pin me",
      ])
      const newStep = stepsAdded.find(
        s => s.description === "Check the gutters",
      )

      // Raised todos: the followup, the new step's followup, and the
      // unpinned ad_hoc — all scoped to the inspection's structure. The "ok"
      // verdict records nothing.
      const todos = await maintenanceFor(tx, inspection.id)
      expect(todos).toHaveLength(3)
      for (const t of todos) {
        expect(t).toMatchObject({
          structure_id: structure.id,
          category: "maintenance",
          status: "todo",
          recurrence: "once",
          added_by: member.id,
        })
      }
      const byDescription = new Map(todos.map(t => [t.description, t]))
      expect(byDescription.get("Fix the hinge")?.source_step_id).toBe(step.id)
      expect(byDescription.get("Clear the gutters")?.source_step_id).toBe(
        newStep?.id,
      )
      expect(byDescription.get("Loose board")?.source_step_id).toBeNull()
    })
  })

  it("rejects unknown, already-completed and cross-location targets", async () => {
    await withRollback(async tx => {
      const { member, structure, foreignStructure } = await seed(tx)
      const foreignStep = await seedStep(tx, foreignStructure.id, member.id)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const inspection = await caller.inspection.start({
        structure_id: structure.id,
        inspected_by: "Member",
        recurrence: "spring",
      })
      const base = {
        id: inspection.id,
        inspected_by: "Member",
        recurrence: "spring" as const,
      }

      // A followup may only reference a step of this inspection's location.
      await expect(
        caller.inspection.complete({
          ...base,
          findings: [
            {
              kind: "step_result",
              step_id: foreignStep.id,
              status: "followup",
              followup_description: "Cross-property followup",
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "procedure step does not belong to this inspection",
      })
      const stillOpen = await tx
        .select({ completed_at: inspectionsTable.completed_at })
        .from(inspectionsTable)
        .where(eq(inspectionsTable.id, inspection.id))
      expect(stillOpen[0].completed_at).toBeNull()

      // Characterization: an "ok" verdict is skipped before the ownership
      // check, so a foreign step id passes silently and records nothing.
      await caller.inspection.complete({
        ...base,
        findings: [
          { kind: "step_result", step_id: foreignStep.id, status: "ok" },
        ],
      })
      expect(await maintenanceFor(tx, inspection.id)).toHaveLength(0)

      await expect(
        caller.inspection.complete({ ...base, findings: [] }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "inspection already completed",
      })
      await expect(
        caller.inspection.complete({ ...base, id: 999999999, findings: [] }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  it("is member-gated, as is delete", async () => {
    await withRollback(async tx => {
      const { member, outsider, structure } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const inspection = await caller.inspection.start({
        structure_id: structure.id,
        inspected_by: "Member",
        recurrence: "spring",
      })
      const outsiderCaller = createCaller(ctxFor(tx, authUser(outsider)))
      await expect(
        outsiderCaller.inspection.complete({
          id: inspection.id,
          inspected_by: "Outsider",
          recurrence: "spring",
          findings: [],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        outsiderCaller.inspection.delete({ id: inspection.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

describe("record and delete", () => {
  it("record creates a completed inspection in one shot; delete unlinks its findings", async () => {
    await withRollback(async tx => {
      const { member, equipment } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(member)))
      const inspection = await caller.inspection.record({
        equipment_id: equipment.id,
        inspected_by: "Member",
        recurrence: "closing",
        findings: [
          { kind: "ad_hoc", description: "Replace the seal", pin: false },
        ],
      })
      expect(inspection.completed_at).not.toBeNull()
      const todos = await maintenanceFor(tx, inspection.id)
      expect(todos).toHaveLength(1)
      expect(todos[0]).toMatchObject({
        description: "Replace the seal",
        equipment_id: equipment.id,
      })

      await caller.inspection.delete({ id: inspection.id })
      const gone = await tx
        .select()
        .from(inspectionsTable)
        .where(eq(inspectionsTable.id, inspection.id))
      expect(gone).toHaveLength(0)
      // The raised todo survives, unlinked from the deleted inspection.
      const survivor = await tx
        .select()
        .from(maintenanceTable)
        .where(eq(maintenanceTable.id, todos[0].id))
      expect(survivor).toHaveLength(1)
      expect(survivor[0].inspection_id).toBeNull()
    })
  })
})
