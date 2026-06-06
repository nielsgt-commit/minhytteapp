import { relations } from "drizzle-orm"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "./booking.schema.ts"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceTable,
} from "./maintenance.schema.ts"
import {
  infrastructureTable,
  parkingClaimsTable,
  propertyContactsTable,
  propertyOwnersTable,
  propertyTable,
  roomTable,
  structuresTable,
} from "./property.schema.ts"
import {
  expenseSharesTable,
  expensesTable,
  settlementUserGroupTotalsTable,
  settlementTransfersTable,
  settlementsTable,
} from "./settlement.schema.ts"
import { stayTable } from "./stay.schema.ts"
import { eventTable } from "./event.schema.ts"
import {
  userGroupMembersTable,
  userGroupsTable,
  usersTable,
} from "./users.schema.ts"

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  bookingsBooked: many(bookingTable, { relationName: "booking_booker" }),
  bookingsCancelled: many(bookingTable, {
    relationName: "booking_cancelled_by",
  }),
  groupMemberships: many(userGroupMembersTable),
  propertyOwnerships: many(propertyOwnersTable),
  bookingOccupancies: many(bookingOccupantsTable),
  maintenanceAdded: many(maintenanceTable, {
    relationName: "maintenance_added_by",
  }),
  maintenanceAssigned: many(maintenanceTable, {
    relationName: "maintenance_assigned_to",
  }),
  inspectionsStarted: many(inspectionsTable),
  expensesPaid: many(expensesTable, { relationName: "expense_payer" }),
  expensesReimbursed: many(expensesTable, {
    relationName: "expense_reimbursed_by",
  }),
  expenseShares: many(expenseSharesTable),
  stays: many(stayTable),
  events: many(eventTable),
  parent: one(usersTable, {
    fields: [usersTable.parent_user_id],
    references: [usersTable.id],
    relationName: "user_parent",
  }),
  children: many(usersTable, { relationName: "user_parent" }),
}))

export const userGroupsRelations = relations(userGroupsTable, ({ many }) => ({
  settlementTotals: many(settlementUserGroupTotalsTable),
  transfersFrom: many(settlementTransfersTable, {
    relationName: "transfer_from_user_group",
  }),
  transfersTo: many(settlementTransfersTable, {
    relationName: "transfer_to_user_group",
  }),
  members: many(userGroupMembersTable),
  propertyOwnerships: many(propertyOwnersTable),
}))

export const userGroupMembersRelations = relations(
  userGroupMembersTable,
  ({ one }) => ({
    group: one(userGroupsTable, {
      fields: [userGroupMembersTable.user_group_id],
      references: [userGroupsTable.id],
    }),
    user: one(usersTable, {
      fields: [userGroupMembersTable.user_id],
      references: [usersTable.id],
    }),
  }),
)

export const propertyRelations = relations(propertyTable, ({ many }) => ({
  structures: many(structuresTable),
  infrastructure: many(infrastructureTable),
  bookings: many(bookingTable),
  owners: many(propertyOwnersTable),
  equipment: many(equipmentTable),
  stays: many(stayTable),
  parkingClaims: many(parkingClaimsTable),
  events: many(eventTable),
  contacts: many(propertyContactsTable),
  expenses: many(expensesTable),
  settlements: many(settlementsTable),
}))

export const propertyContactsRelations = relations(
  propertyContactsTable,
  ({ one }) => ({
    property: one(propertyTable, {
      fields: [propertyContactsTable.property_id],
      references: [propertyTable.id],
    }),
  }),
)

export const eventRelations = relations(eventTable, ({ one }) => ({
  property: one(propertyTable, {
    fields: [eventTable.property_id],
    references: [propertyTable.id],
  }),
  author: one(usersTable, {
    fields: [eventTable.author_id],
    references: [usersTable.id],
  }),
}))

export const stayRelations = relations(stayTable, ({ one }) => ({
  property: one(propertyTable, {
    fields: [stayTable.property_id],
    references: [propertyTable.id],
  }),
  user: one(usersTable, {
    fields: [stayTable.user_id],
    references: [usersTable.id],
  }),
}))

export const parkingClaimsRelations = relations(
  parkingClaimsTable,
  ({ one }) => ({
    property: one(propertyTable, {
      fields: [parkingClaimsTable.property_id],
      references: [propertyTable.id],
    }),
    user: one(usersTable, {
      fields: [parkingClaimsTable.user_id],
      references: [usersTable.id],
    }),
  }),
)

export const propertyOwnersRelations = relations(
  propertyOwnersTable,
  ({ one }) => ({
    property: one(propertyTable, {
      fields: [propertyOwnersTable.property_id],
      references: [propertyTable.id],
    }),
    userGroup: one(userGroupsTable, {
      fields: [propertyOwnersTable.user_group_id],
      references: [userGroupsTable.id],
    }),
  }),
)

export const structuresRelations = relations(
  structuresTable,
  ({ one, many }) => ({
    property: one(propertyTable, {
      fields: [structuresTable.property_id],
      references: [propertyTable.id],
    }),
    rooms: many(roomTable),
    maintenance: many(maintenanceTable),
    inspections: many(inspectionsTable),
  }),
)

export const roomRelations = relations(roomTable, ({ one, many }) => ({
  structure: one(structuresTable, {
    fields: [roomTable.structure_id],
    references: [structuresTable.id],
  }),
  bookings: many(bookingRoomsTable),
}))

export const infrastructureRelations = relations(
  infrastructureTable,
  ({ one, many }) => ({
    property: one(propertyTable, {
      fields: [infrastructureTable.property_id],
      references: [propertyTable.id],
    }),
    maintenance: many(maintenanceTable),
    inspections: many(inspectionsTable),
  }),
)

export const bookingRelations = relations(bookingTable, ({ one, many }) => ({
  property: one(propertyTable, {
    fields: [bookingTable.property_id],
    references: [propertyTable.id],
  }),
  booker: one(usersTable, {
    fields: [bookingTable.booker_id],
    references: [usersTable.id],
    relationName: "booking_booker",
  }),
  cancelledBy: one(usersTable, {
    fields: [bookingTable.cancelled_by_id],
    references: [usersTable.id],
    relationName: "booking_cancelled_by",
  }),
  rooms: many(bookingRoomsTable),
  occupants: many(bookingOccupantsTable),
  expenses: many(expensesTable),
}))

export const bookingRoomsRelations = relations(
  bookingRoomsTable,
  ({ one }) => ({
    booking: one(bookingTable, {
      fields: [bookingRoomsTable.booking_id],
      references: [bookingTable.id],
    }),
    room: one(roomTable, {
      fields: [bookingRoomsTable.room_id],
      references: [roomTable.id],
    }),
  }),
)

export const bookingOccupantsRelations = relations(
  bookingOccupantsTable,
  ({ one }) => ({
    booking: one(bookingTable, {
      fields: [bookingOccupantsTable.booking_id],
      references: [bookingTable.id],
    }),
    user: one(usersTable, {
      fields: [bookingOccupantsTable.user_id],
      references: [usersTable.id],
    }),
    room: one(roomTable, {
      fields: [bookingOccupantsTable.room_id],
      references: [roomTable.id],
    }),
  }),
)

export const maintenanceRelations = relations(
  maintenanceTable,
  ({ one, many }) => ({
    addedByUser: one(usersTable, {
      fields: [maintenanceTable.added_by],
      references: [usersTable.id],
      relationName: "maintenance_added_by",
    }),
    assignedToUser: one(usersTable, {
      fields: [maintenanceTable.assigned_to_id],
      references: [usersTable.id],
      relationName: "maintenance_assigned_to",
    }),
    structure: one(structuresTable, {
      fields: [maintenanceTable.structure_id],
      references: [structuresTable.id],
    }),
    infrastructure: one(infrastructureTable, {
      fields: [maintenanceTable.infrastructure_id],
      references: [infrastructureTable.id],
    }),
    equipment: one(equipmentTable, {
      fields: [maintenanceTable.equipment_id],
      references: [equipmentTable.id],
    }),
    parent: one(maintenanceTable, {
      fields: [maintenanceTable.parent_maintenance_id],
      references: [maintenanceTable.id],
      relationName: "maintenance_parent",
    }),
    followups: many(maintenanceTable, { relationName: "maintenance_parent" }),
    inspection: one(inspectionsTable, {
      fields: [maintenanceTable.inspection_id],
      references: [inspectionsTable.id],
    }),
    duePriorityGroup: one(userGroupsTable, {
      fields: [maintenanceTable.due_priority_group_id],
      references: [userGroupsTable.id],
      relationName: "maintenance_due_priority_group",
    }),
    expenses: many(expensesTable),
  }),
)

export const inspectionsRelations = relations(
  inspectionsTable,
  ({ one, many }) => ({
    structure: one(structuresTable, {
      fields: [inspectionsTable.structure_id],
      references: [structuresTable.id],
    }),
    infrastructure: one(infrastructureTable, {
      fields: [inspectionsTable.infrastructure_id],
      references: [infrastructureTable.id],
    }),
    equipment: one(equipmentTable, {
      fields: [inspectionsTable.equipment_id],
      references: [equipmentTable.id],
    }),
    startedByUser: one(usersTable, {
      fields: [inspectionsTable.started_by_user_id],
      references: [usersTable.id],
    }),
    findings: many(maintenanceTable),
  }),
)

export const equipmentRelations = relations(
  equipmentTable,
  ({ one, many }) => ({
    property: one(propertyTable, {
      fields: [equipmentTable.property_id],
      references: [propertyTable.id],
    }),
    maintenance: many(maintenanceTable),
    inspections: many(inspectionsTable),
  }),
)

export const settlementsRelations = relations(
  settlementsTable,
  ({ one, many }) => ({
    property: one(propertyTable, {
      fields: [settlementsTable.property_id],
      references: [propertyTable.id],
    }),
    expenses: many(expensesTable),
    userGroupTotals: many(settlementUserGroupTotalsTable),
    transfers: many(settlementTransfersTable),
  }),
)

export const expensesRelations = relations(expensesTable, ({ one, many }) => ({
  property: one(propertyTable, {
    fields: [expensesTable.property_id],
    references: [propertyTable.id],
  }),
  payer: one(usersTable, {
    fields: [expensesTable.payer_id],
    references: [usersTable.id],
    relationName: "expense_payer",
  }),
  reimbursedBy: one(usersTable, {
    fields: [expensesTable.reimbursed_by_id],
    references: [usersTable.id],
    relationName: "expense_reimbursed_by",
  }),
  booking: one(bookingTable, {
    fields: [expensesTable.booking_id],
    references: [bookingTable.id],
  }),
  maintenance: one(maintenanceTable, {
    fields: [expensesTable.maintenance_id],
    references: [maintenanceTable.id],
  }),
  settlement: one(settlementsTable, {
    fields: [expensesTable.settlement_id],
    references: [settlementsTable.id],
  }),
  shares: many(expenseSharesTable),
}))

export const expenseSharesRelations = relations(
  expenseSharesTable,
  ({ one }) => ({
    expense: one(expensesTable, {
      fields: [expenseSharesTable.expense_id],
      references: [expensesTable.id],
    }),
    user: one(usersTable, {
      fields: [expenseSharesTable.user_id],
      references: [usersTable.id],
    }),
  }),
)

export const settlementUserGroupTotalsRelations = relations(
  settlementUserGroupTotalsTable,
  ({ one }) => ({
    settlement: one(settlementsTable, {
      fields: [settlementUserGroupTotalsTable.settlement_id],
      references: [settlementsTable.id],
    }),
    userGroup: one(userGroupsTable, {
      fields: [settlementUserGroupTotalsTable.user_group_id],
      references: [userGroupsTable.id],
    }),
  }),
)

export const settlementTransfersRelations = relations(
  settlementTransfersTable,
  ({ one }) => ({
    settlement: one(settlementsTable, {
      fields: [settlementTransfersTable.settlement_id],
      references: [settlementsTable.id],
    }),
    fromUserGroup: one(userGroupsTable, {
      fields: [settlementTransfersTable.from_user_group_id],
      references: [userGroupsTable.id],
      relationName: "transfer_from_user_group",
    }),
    toUserGroup: one(userGroupsTable, {
      fields: [settlementTransfersTable.to_user_group_id],
      references: [userGroupsTable.id],
      relationName: "transfer_to_user_group",
    }),
  }),
)
