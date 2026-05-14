import { relations } from "drizzle-orm"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "./booking.schema.ts"
import {
  equipmentTable,
  inspectionsTable,
  maintenanceAttachmentsTable,
  maintenanceTable,
  maintenanceUpdatesTable,
  routinesTable,
} from "./maintenance.schema.ts"
import {
  buildingAdjacenciesTable,
  buildingsTable,
  parkingClaimsTable,
  placeTable,
  propertyContactsTable,
  propertyInvitationsTable,
  propertyOwnersTable,
  propertyTable,
  roomAdjacenciesTable,
  roomTable,
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
  maintenanceUpdates: many(maintenanceUpdatesTable),
  maintenanceAttachments: many(maintenanceAttachmentsTable),
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
  buildings: many(buildingsTable),
  places: many(placeTable),
  bookings: many(bookingTable),
  owners: many(propertyOwnersTable),
  invitations: many(propertyInvitationsTable),
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

export const parkingClaimsRelations = relations(parkingClaimsTable, ({ one }) => ({
  property: one(propertyTable, {
    fields: [parkingClaimsTable.property_id],
    references: [propertyTable.id],
  }),
  user: one(usersTable, {
    fields: [parkingClaimsTable.user_id],
    references: [usersTable.id],
  }),
}))

export const propertyInvitationsRelations = relations(
  propertyInvitationsTable,
  ({ one }) => ({
    property: one(propertyTable, {
      fields: [propertyInvitationsTable.property_id],
      references: [propertyTable.id],
    }),
    createdBy: one(usersTable, {
      fields: [propertyInvitationsTable.created_by_user_id],
      references: [usersTable.id],
      relationName: "invitation_created_by",
    }),
    usedBy: one(usersTable, {
      fields: [propertyInvitationsTable.used_by_user_id],
      references: [usersTable.id],
      relationName: "invitation_used_by",
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
    user: one(usersTable, {
      fields: [propertyOwnersTable.user_id],
      references: [usersTable.id],
    }),
    userGroup: one(userGroupsTable, {
      fields: [propertyOwnersTable.user_group_id],
      references: [userGroupsTable.id],
    }),
  }),
)

export const buildingsRelations = relations(buildingsTable, ({ one, many }) => ({
  property: one(propertyTable, {
    fields: [buildingsTable.property_id],
    references: [propertyTable.id],
  }),
  rooms: many(roomTable),
  adjacenciesA: many(buildingAdjacenciesTable, {
    relationName: "building_adjacency_a",
  }),
  adjacenciesB: many(buildingAdjacenciesTable, {
    relationName: "building_adjacency_b",
  }),
  maintenance: many(maintenanceTable),
  equipment: many(equipmentTable),
  inspections: many(inspectionsTable),
}))

export const buildingAdjacenciesRelations = relations(
  buildingAdjacenciesTable,
  ({ one }) => ({
    buildingA: one(buildingsTable, {
      fields: [buildingAdjacenciesTable.building_a],
      references: [buildingsTable.id],
      relationName: "building_adjacency_a",
    }),
    buildingB: one(buildingsTable, {
      fields: [buildingAdjacenciesTable.building_b],
      references: [buildingsTable.id],
      relationName: "building_adjacency_b",
    }),
  }),
)

export const roomRelations = relations(roomTable, ({ one, many }) => ({
  building: one(buildingsTable, {
    fields: [roomTable.building_id],
    references: [buildingsTable.id],
  }),
  bookings: many(bookingRoomsTable),
  adjacenciesA: many(roomAdjacenciesTable, {
    relationName: "room_adjacency_a",
  }),
  adjacenciesB: many(roomAdjacenciesTable, {
    relationName: "room_adjacency_b",
  }),
}))

export const roomAdjacenciesRelations = relations(
  roomAdjacenciesTable,
  ({ one }) => ({
    roomA: one(roomTable, {
      fields: [roomAdjacenciesTable.room_a],
      references: [roomTable.id],
      relationName: "room_adjacency_a",
    }),
    roomB: one(roomTable, {
      fields: [roomAdjacenciesTable.room_b],
      references: [roomTable.id],
      relationName: "room_adjacency_b",
    }),
  }),
)

export const placeRelations = relations(placeTable, ({ one, many }) => ({
  property: one(propertyTable, {
    fields: [placeTable.property_id],
    references: [propertyTable.id],
  }),
  maintenance: many(maintenanceTable),
  inspections: many(inspectionsTable),
}))

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

export const bookingRoomsRelations = relations(bookingRoomsTable, ({ one }) => ({
  booking: one(bookingTable, {
    fields: [bookingRoomsTable.booking_id],
    references: [bookingTable.id],
  }),
  room: one(roomTable, {
    fields: [bookingRoomsTable.room_id],
    references: [roomTable.id],
  }),
}))

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

export const routinesRelations = relations(routinesTable, ({ many }) => ({
  tasks: many(maintenanceTable),
}))

export const maintenanceRelations = relations(maintenanceTable, ({ one, many }) => ({
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
  building: one(buildingsTable, {
    fields: [maintenanceTable.building_id],
    references: [buildingsTable.id],
  }),
  place: one(placeTable, {
    fields: [maintenanceTable.place_id],
    references: [placeTable.id],
  }),
  routine: one(routinesTable, {
    fields: [maintenanceTable.routine_id],
    references: [routinesTable.id],
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
  updates: many(maintenanceUpdatesTable),
  attachments: many(maintenanceAttachmentsTable),
  expenses: many(expensesTable),
}))

export const inspectionsRelations = relations(
  inspectionsTable,
  ({ one, many }) => ({
    building: one(buildingsTable, {
      fields: [inspectionsTable.building_id],
      references: [buildingsTable.id],
    }),
    place: one(placeTable, {
      fields: [inspectionsTable.place_id],
      references: [placeTable.id],
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

export const equipmentRelations = relations(equipmentTable, ({ one, many }) => ({
  property: one(propertyTable, {
    fields: [equipmentTable.property_id],
    references: [propertyTable.id],
  }),
  building: one(buildingsTable, {
    fields: [equipmentTable.building_id],
    references: [buildingsTable.id],
  }),
  maintenance: many(maintenanceTable),
  inspections: many(inspectionsTable),
}))

export const maintenanceUpdatesRelations = relations(
  maintenanceUpdatesTable,
  ({ one }) => ({
    maintenance: one(maintenanceTable, {
      fields: [maintenanceUpdatesTable.maintenance_id],
      references: [maintenanceTable.id],
    }),
    author: one(usersTable, {
      fields: [maintenanceUpdatesTable.author_id],
      references: [usersTable.id],
    }),
  }),
)

export const maintenanceAttachmentsRelations = relations(
  maintenanceAttachmentsTable,
  ({ one }) => ({
    maintenance: one(maintenanceTable, {
      fields: [maintenanceAttachmentsTable.maintenance_id],
      references: [maintenanceTable.id],
    }),
    uploadedByUser: one(usersTable, {
      fields: [maintenanceAttachmentsTable.uploaded_by],
      references: [usersTable.id],
    }),
  }),
)

export const settlementsRelations = relations(settlementsTable, ({ one, many }) => ({
  property: one(propertyTable, {
    fields: [settlementsTable.property_id],
    references: [propertyTable.id],
  }),
  expenses: many(expensesTable),
  userGroupTotals: many(settlementUserGroupTotalsTable),
  transfers: many(settlementTransfersTable),
}))

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

export const expenseSharesRelations = relations(expenseSharesTable, ({ one }) => ({
  expense: one(expensesTable, {
    fields: [expenseSharesTable.expense_id],
    references: [expensesTable.id],
  }),
  user: one(usersTable, {
    fields: [expenseSharesTable.user_id],
    references: [usersTable.id],
  }),
}))

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