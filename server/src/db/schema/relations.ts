import { relations } from "drizzle-orm"
import {
  bookingOccupantsTable,
  bookingRoomsTable,
  bookingTable,
} from "./booking.schema.ts"
import {
  maintenanceAttachmentsTable,
  maintenanceTable,
  maintenanceUpdatesTable,
  routinesTable,
} from "./maintenance.schema.ts"
import {
  buildingAdjacenciesTable,
  buildingsTable,
  placeTable,
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
import {
  userGroupsTable,
  usersTable,
} from "./users.schema.ts"

export const usersRelations = relations(usersTable, ({ many }) => ({
  propertyOwnerships: many(propertyOwnersTable),
  bookingsBooked: many(bookingTable),
  bookingOccupancies: many(bookingOccupantsTable),
  maintenanceAdded: many(maintenanceTable, {
    relationName: "maintenance_added_by",
  }),
  maintenanceAssigned: many(maintenanceTable, {
    relationName: "maintenance_assigned_to",
  }),
  maintenanceUpdates: many(maintenanceUpdatesTable),
  maintenanceAttachments: many(maintenanceAttachmentsTable),
  expensesPaid: many(expensesTable, { relationName: "expense_payer" }),
  expensesReimbursed: many(expensesTable, {
    relationName: "expense_reimbursed_by",
  }),
  expenseShares: many(expenseSharesTable),
}))

export const userGroupsRelations = relations(userGroupsTable, ({ many }) => ({
  settlementTotals: many(settlementUserGroupTotalsTable),
  transfersFrom: many(settlementTransfersTable, {
    relationName: "transfer_from_user_group",
  }),
  transfersTo: many(settlementTransfersTable, {
    relationName: "transfer_to_user_group",
  }),
}))

export const propertyRelations = relations(propertyTable, ({ many }) => ({
  buildings: many(buildingsTable),
  places: many(placeTable),
  owners: many(propertyOwnersTable),
  bookings: many(bookingTable),
}))

export const propertyOwnersRelations = relations(propertyOwnersTable, ({ one }) => ({
  property: one(propertyTable, {
    fields: [propertyOwnersTable.property_id],
    references: [propertyTable.id],
  }),
  user: one(usersTable, {
    fields: [propertyOwnersTable.user_id],
    references: [usersTable.id],
  }),
}))

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
}))

export const bookingRelations = relations(bookingTable, ({ one, many }) => ({
  property: one(propertyTable, {
    fields: [bookingTable.property_id],
    references: [propertyTable.id],
  }),
  booker: one(usersTable, {
    fields: [bookingTable.booker_id],
    references: [usersTable.id],
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
  updates: many(maintenanceUpdatesTable),
  attachments: many(maintenanceAttachmentsTable),
  expenses: many(expensesTable),
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

export const settlementsRelations = relations(settlementsTable, ({ many }) => ({
  expenses: many(expensesTable),
  userGroupTotals: many(settlementUserGroupTotalsTable),
  transfers: many(settlementTransfersTable),
}))

export const expensesRelations = relations(expensesTable, ({ one, many }) => ({
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