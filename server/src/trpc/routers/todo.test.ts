// Characterization tests for the todo router's two authz seams: `delete` is
// deliberately protectedProcedure + assertPropertyMember (any member may clear
// a todo, unlike the propertyAdminProcedure write surface), and
// moveToMaintenance must scope the created maintenance row to the target and
// refuse cross-property targets. Read-IDOR sweeps live in authorization.test.ts.

import { afterAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { pool } from "../../db/client.ts"
import {
  equipmentTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  propertyTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import { todosTable } from "../../db/schema/todo.schema.ts"
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

// One property with two plain members plus an outsider; a structure and a
// piece of equipment as move targets, and a second property whose equipment
// must be unreachable across the boundary.
async function seed(tx: Tx) {
  const [prop, otherProp] = await tx
    .insert(propertyTable)
    .values([
      { name: "Todo Test Prop", address: "addr" },
      { name: "Todo Test Other Prop", address: "addr2" },
    ])
    .returning()
  const [memberA, memberB, outsider] = await tx
    .insert(usersTable)
    .values([
      { name: "Member A", email: "todo-test-member-a@example.test" },
      { name: "Member B", email: "todo-test-member-b@example.test" },
      { name: "Outsider", email: "todo-test-outsider@example.test" },
    ])
    .returning()
  const [group] = await tx
    .insert(userGroupsTable)
    .values({ name: "Todo Fam", is_family: true, property_id: prop.id })
    .returning()
  await tx.insert(userGroupMembersTable).values([
    { user_group_id: group.id, user_id: memberA.id, is_head: false },
    { user_group_id: group.id, user_id: memberB.id, is_head: false },
  ])
  const [structure] = await tx
    .insert(structuresTable)
    .values({ name: "Cabin", property_id: prop.id })
    .returning()
  const [equipment, foreignEquipment] = await tx
    .insert(equipmentTable)
    .values([
      { name: "Mower", property_id: prop.id },
      { name: "Foreign Mower", property_id: otherProp.id },
    ])
    .returning()
  return {
    prop,
    memberA,
    memberB,
    outsider,
    structure,
    equipment,
    foreignEquipment,
  }
}

async function createTodo(caller: Caller, propertyId: number, text: string) {
  const result = await caller.todo.create({
    property_id: propertyId,
    description: text,
  })
  if (result.kind !== "todo") throw new Error("expected a plain todo")
  return result.todo
}

type Caller = ReturnType<typeof createCaller>

async function todoRows(tx: Tx, id: number) {
  return tx.select().from(todosTable).where(eq(todosTable.id, id))
}

afterAll(async () => {
  await pool.end()
})

describe("delete", () => {
  it("lets any property member delete another member's todo", async () => {
    await withRollback(async tx => {
      const { prop, memberA, memberB } = await seed(tx)
      const callerA = createCaller(ctxFor(tx, authUser(memberA)))
      const todo = await createTodo(callerA, prop.id, "Fix the gate")

      const deleted = await createCaller(
        ctxFor(tx, authUser(memberB)),
      ).todo.delete({ id: todo.id })
      expect(deleted.id).toBe(todo.id)
      expect(await todoRows(tx, todo.id)).toHaveLength(0)
    })
  })

  it("refuses a non-member", async () => {
    await withRollback(async tx => {
      const { prop, memberA, outsider } = await seed(tx)
      const callerA = createCaller(ctxFor(tx, authUser(memberA)))
      const todo = await createTodo(callerA, prop.id, "Fix the gate")

      await expect(
        createCaller(ctxFor(tx, authUser(outsider))).todo.delete({
          id: todo.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      expect(await todoRows(tx, todo.id)).toHaveLength(1)
    })
  })
})

describe("moveToMaintenance", () => {
  it("creates a maintenance row scoped to the target and deletes the todo", async () => {
    await withRollback(async tx => {
      const { prop, memberA, structure, equipment } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(memberA)))

      const eqTodo = await createTodo(caller, prop.id, "Sharpen the mower")
      await caller.todo.moveToMaintenance({
        property_id: prop.id,
        id: eqTodo.id,
        target: { kind: "equipment", id: equipment.id },
      })
      const eqRows = await tx
        .select()
        .from(maintenanceTable)
        .where(eq(maintenanceTable.equipment_id, equipment.id))
      expect(eqRows).toHaveLength(1)
      expect(eqRows[0]).toMatchObject({
        description: "Sharpen the mower",
        structure_id: null,
        infrastructure_id: null,
        equipment_id: equipment.id,
        category: "maintenance",
        severity: "patch",
        status: "todo",
        recurrence: "once",
        due_kind: "not_decided",
        added_by: memberA.id,
      })
      expect(await todoRows(tx, eqTodo.id)).toHaveLength(0)

      const structTodo = await createTodo(caller, prop.id, "Paint the cabin")
      await caller.todo.moveToMaintenance({
        property_id: prop.id,
        id: structTodo.id,
        target: { kind: "structure", id: structure.id },
      })
      const structRows = await tx
        .select()
        .from(maintenanceTable)
        .where(eq(maintenanceTable.structure_id, structure.id))
      expect(structRows).toHaveLength(1)
      expect(structRows[0]).toMatchObject({
        description: "Paint the cabin",
        structure_id: structure.id,
        infrastructure_id: null,
        equipment_id: null,
      })
      expect(await todoRows(tx, structTodo.id)).toHaveLength(0)
    })
  })

  it("rejects a target belonging to another property and keeps the todo", async () => {
    await withRollback(async tx => {
      const { prop, memberA, foreignEquipment } = await seed(tx)
      const caller = createCaller(ctxFor(tx, authUser(memberA)))
      const todo = await createTodo(caller, prop.id, "Sneaky move")

      await expect(
        caller.todo.moveToMaintenance({
          property_id: prop.id,
          id: todo.id,
          target: { kind: "equipment", id: foreignEquipment.id },
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "target does not belong to this property",
      })
      expect(await todoRows(tx, todo.id)).toHaveLength(1)
      const rows = await tx
        .select()
        .from(maintenanceTable)
        .where(eq(maintenanceTable.equipment_id, foreignEquipment.id))
      expect(rows).toHaveLength(0)
    })
  })
})
