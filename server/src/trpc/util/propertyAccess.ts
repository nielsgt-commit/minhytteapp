import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import type { db as dbClient } from "../../db/client.ts"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceTable,
} from "../../db/schema/maintenance.schema.ts"
import {
  infrastructureTable,
  roomTable,
  structuresTable,
} from "../../db/schema/property.schema.ts"
import { shoppingListItemsTable } from "../../db/schema/shopping.schema.ts"
import { todosTable } from "../../db/schema/todo.schema.ts"

type Db = typeof dbClient

function notFound(message: string): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message })
}

export async function resolvePropertyIdFromStructure(
  db: Db,
  structureId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: structuresTable.property_id })
      .from(structuresTable)
      .where(eq(structuresTable.id, structureId))
      .limit(1)
  ).at(0)
  if (!row) throw notFound("structure not found")
  return row.property_id
}

export async function resolvePropertyIdFromRoom(
  db: Db,
  roomId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: structuresTable.property_id })
      .from(roomTable)
      .innerJoin(
        structuresTable,
        eq(structuresTable.id, roomTable.structure_id),
      )
      .where(eq(roomTable.id, roomId))
      .limit(1)
  ).at(0)
  if (!row) throw notFound("room not found")
  return row.property_id
}

export async function resolvePropertyIdFromEquipment(
  db: Db,
  equipmentId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: equipmentTable.property_id })
      .from(equipmentTable)
      .where(eq(equipmentTable.id, equipmentId))
      .limit(1)
  ).at(0)
  if (!row) throw notFound("equipment not found")
  return row.property_id
}

export async function resolvePropertyIdFromShoppingItem(
  db: Db,
  shoppingItemId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: shoppingListItemsTable.property_id })
      .from(shoppingListItemsTable)
      .where(eq(shoppingListItemsTable.id, shoppingItemId))
      .limit(1)
  ).at(0)
  if (!row) throw notFound("shopping list item not found")
  return row.property_id
}

export async function resolvePropertyIdFromTodo(
  db: Db,
  todoId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: todosTable.property_id })
      .from(todosTable)
      .where(eq(todosTable.id, todoId))
      .limit(1)
  ).at(0)
  if (!row) throw notFound("todo not found")
  return row.property_id
}

export async function resolvePropertyIdFromInfrastructure(
  db: Db,
  infrastructureId: number,
): Promise<number> {
  const row = (
    await db
      .select({ property_id: infrastructureTable.property_id })
      .from(infrastructureTable)
      .where(eq(infrastructureTable.id, infrastructureId))
      .limit(1)
  ).at(0)
  if (row?.property_id == null) throw notFound("infrastructure not found")
  return row.property_id
}

type ParentIds = {
  structure_id?: number | null
  infrastructure_id?: number | null
  equipment_id?: number | null
}

export async function resolvePropertyIdFromMaintenanceParent(
  db: Db,
  parent: ParentIds,
): Promise<number> {
  if (parent.structure_id != null) {
    return resolvePropertyIdFromStructure(db, parent.structure_id)
  }
  if (parent.infrastructure_id != null) {
    return resolvePropertyIdFromInfrastructure(db, parent.infrastructure_id)
  }
  if (parent.equipment_id != null) {
    return resolvePropertyIdFromEquipment(db, parent.equipment_id)
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "one of structure_id, infrastructure_id, or equipment_id required",
  })
}

export async function resolvePropertyIdFromMaintenance(
  db: Db,
  maintenanceId: number,
): Promise<number> {
  const row = (
    await db
      .select({
        structure_property_id: structuresTable.property_id,
        infrastructure_property_id: infrastructureTable.property_id,
        equipment_property_id: equipmentTable.property_id,
      })
      .from(maintenanceTable)
      .leftJoin(
        structuresTable,
        eq(structuresTable.id, maintenanceTable.structure_id),
      )
      .leftJoin(
        infrastructureTable,
        eq(infrastructureTable.id, maintenanceTable.infrastructure_id),
      )
      .leftJoin(
        equipmentTable,
        eq(equipmentTable.id, maintenanceTable.equipment_id),
      )
      .where(eq(maintenanceTable.id, maintenanceId))
      .limit(1)
  ).at(0)
  if (!row) throw notFound("maintenance not found")
  const propertyId =
    row.structure_property_id ??
    row.infrastructure_property_id ??
    row.equipment_property_id
  if (propertyId == null) throw notFound("maintenance not found")
  return propertyId
}

export async function resolvePropertyIdFromInspection(
  db: Db,
  inspectionId: number,
): Promise<number> {
  const row = (
    await db
      .select({
        structure_property_id: structuresTable.property_id,
        infrastructure_property_id: infrastructureTable.property_id,
        equipment_property_id: equipmentTable.property_id,
      })
      .from(inspectionsTable)
      .leftJoin(
        structuresTable,
        eq(structuresTable.id, inspectionsTable.structure_id),
      )
      .leftJoin(
        infrastructureTable,
        eq(infrastructureTable.id, inspectionsTable.infrastructure_id),
      )
      .leftJoin(
        equipmentTable,
        eq(equipmentTable.id, inspectionsTable.equipment_id),
      )
      .where(eq(inspectionsTable.id, inspectionId))
      .limit(1)
  ).at(0)
  if (!row) throw notFound("inspection not found")
  const propertyId =
    row.structure_property_id ??
    row.infrastructure_property_id ??
    row.equipment_property_id
  if (propertyId == null) throw notFound("inspection not found")
  return propertyId
}
