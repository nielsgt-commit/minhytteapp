import { sql } from "drizzle-orm"
import {
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core"
import { usersTable, userGroupsTable } from "./users.schema.ts"
import { bookingTable } from "./booking.schema.ts"
import { maintenanceTable } from "./maintenance.schema.ts"
import { propertyTable } from "./property.schema.ts"

export const settlementsTable = pgTable(
  "settlements",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id").references(() => propertyTable.id),
    year: integer("year").notNull(),
    season: varchar("season", {
      length: 6,
      enum: ["winter", "spring", "summer", "autumn"],
    }),
    status: varchar("status", {
      length: 6,
      enum: ["open", "closed"],
    }).notNull(),
    split_policy: varchar("split_policy", {
      length: 15,
      enum: ["shares", "groups_equal", "occupancy_days"],
    }).notNull(),
    opened_at: timestamp("opened_at").notNull().defaultNow(),
    closed_at: timestamp("closed_at"),
  },
  (t) => [
    unique().on(t.property_id, t.year, t.season),
    check(
      "settlement_closed_has_timestamp",
      sql`(${t.status} = 'closed') = (${t.closed_at} IS NOT NULL)`,
    ),
  ],
)

export const expenseCategoriesTable = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
})

export const expensesTable = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id").references(() => propertyTable.id),
    description: varchar("description", { length: 255 }).notNull(),
    amount: integer("amount").notNull(),
    payer_id: integer("payer_id")
      .notNull()
      .references(() => usersTable.id),
    reimbursed_by_id: integer("reimbursed_by_id").references(() => usersTable.id),
    booking_id: integer("booking_id").references(() => bookingTable.id),
    maintenance_id: integer("maintenance_id").references(() => maintenanceTable.id),
    settlement_id: integer("settlement_id").references(() => settlementsTable.id),
    date: date("date", { mode: "string" }).notNull(),
    status: varchar("status", {
      length: 11,
      enum: ["draft", "submitted", "reimbursed", "rejected"],
    }).notNull(),
    receipt_url: text("receipt_url"),
    expense_types: text("expense_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [
    check(
      "expense_reimbursed_has_reimburser",
      sql`${t.status} <> 'reimbursed' OR ${t.reimbursed_by_id} IS NOT NULL`,
    ),
    check(
      "expense_reimburser_not_payer",
      sql`${t.reimbursed_by_id} <> ${t.payer_id}`,
    ),
  ],
)

export const expenseSharesTable = pgTable(
  "shares",
  {
    expense_id: integer("expense_id")
      .notNull()
      .references(() => expensesTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    share_amount: integer("share_amount").notNull(),
  },
  (t) => [primaryKey({ columns: [t.expense_id, t.user_id] })],
)

export const settlementUserGroupTotalsTable = pgTable(
  "settlement_user_group_totals",
  {
    settlement_id: integer("settlement_id")
      .notNull()
      .references(() => settlementsTable.id, { onDelete: "cascade" }),
    user_group_id: integer("user_group_id")
      .notNull()
      .references(() => userGroupsTable.id),
    total_paid: integer("total_paid").notNull(),
    total_share: integer("total_share").notNull(),
    net: integer("net").notNull(),
  },
  (t) => [primaryKey({ columns: [t.settlement_id, t.user_group_id] })],
)

export const settlementTransfersTable = pgTable(
  "settlement_transfers",
  {
    id: serial("id").primaryKey(),
    settlement_id: integer("settlement_id")
      .notNull()
      .references(() => settlementsTable.id, { onDelete: "cascade" }),
    from_user_group_id: integer("from_user_group_id")
      .notNull()
      .references(() => userGroupsTable.id),
    to_user_group_id: integer("to_user_group_id")
      .notNull()
      .references(() => userGroupsTable.id),
    amount: integer("amount").notNull(),
    status: varchar("status", {
      length: 7,
      enum: ["pending", "paid"],
    }).notNull(),
    paid_at: timestamp("paid_at"),
  },
  (t) => [
    check(
      "transfer_distinct_parties",
      sql`${t.from_user_group_id} <> ${t.to_user_group_id}`,
    ),
    check("transfer_amount_positive", sql`${t.amount} > 0`),
    check(
      "transfer_paid_has_timestamp",
      sql`(${t.status} = 'paid') = (${t.paid_at} IS NOT NULL)`,
    ),
  ],
)