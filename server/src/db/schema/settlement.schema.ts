import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { userGroupsTable, usersTable } from "./users.schema.ts"
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
    phase: varchar("phase", {
      length: 20,
      enum: [
        "collecting_expenses",
        "collecting_bookings",
        "reviewing",
        "split_policy",
        "closed",
      ],
    })
      .notNull()
      .default("collecting_expenses"),
    split_policy: varchar("split_policy", {
      length: 15,
      enum: ["shares", "groups_equal", "occupancy_days"],
    }).notNull(),
    split_policy_id: integer("split_policy_id").references(
      () => propertySplitPoliciesTable.id,
      { onDelete: "set null" },
    ),
    created_by_id: integer("created_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    opened_at: timestamp("opened_at").notNull().defaultNow(),
    closed_at: timestamp("closed_at"),
  },
  (t) => [
    unique().on(t.property_id, t.year, t.season),
    uniqueIndex("settlements_one_open_per_property")
      .on(t.property_id)
      .where(sql`${t.status} = 'open'`),
    check(
      "settlement_closed_has_timestamp",
      sql`(${t.status} = 'closed') = (${t.closed_at} IS NOT NULL)`,
    ),
  ],
)

export const expenseCategoriesTable = pgTable(
  "expense_categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull(),
    archived_at: timestamp("archived_at"),
  },
  (t) => [
    uniqueIndex("expense_categories_name_active")
      .on(t.name)
      .where(sql`${t.archived_at} IS NULL`),
  ],
)

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

export const settlementAcceptancesTable = pgTable(
  "settlement_acceptances",
  {
    settlement_id: integer("settlement_id")
      .notNull()
      .references(() => settlementsTable.id, { onDelete: "cascade" }),
    head_user_id: integer("head_user_id")
      .notNull()
      .references(() => usersTable.id),
    accepted_at: timestamp("accepted_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.settlement_id, t.head_user_id] })],
)

export const settlementBookingAdjustmentsTable = pgTable(
  "settlement_booking_adjustments",
  {
    settlement_id: integer("settlement_id")
      .notNull()
      .references(() => settlementsTable.id, { onDelete: "cascade" }),
    booking_id: integer("booking_id")
      .notNull()
      .references(() => bookingTable.id, { onDelete: "cascade" }),
    excluded: boolean("excluded").notNull().default(false),
    extra_names: text("extra_names")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [primaryKey({ columns: [t.settlement_id, t.booking_id] })],
)

export type SplitPolicyWhat =
  | { kind: "total" }
  | { kind: "category"; category_id: number }

export type SplitPolicyHow =
  | { kind: "equally" }
  | { kind: "weighted_by_occupancy" }
  | { kind: "by_ownership_pct" }

export type SplitPolicyWho =
  | { kind: "all_users" }
  | { kind: "user_group"; group_id: number }
  | { kind: "user"; user_id: number }
  | { kind: "heads_only" }
  | { kind: "main_groups" }

export type SplitPolicyWhen =
  | { kind: "always" }
  | { kind: "present_when_expense_added" }
  | { kind: "present_this_year" }
  | { kind: "during_any_priority_week" }
  | { kind: "during_priority_week"; property_owner_id: number }

export type SplitPolicyExcept =
  | { kind: "user"; user_id: number }
  | { kind: "group"; group_id: number }
  | { kind: "kids" }

export type SplitPolicyRule = {
  what: SplitPolicyWhat
  how: SplitPolicyHow
  who: SplitPolicyWho[]
  except: SplitPolicyExcept[]
  when: SplitPolicyWhen
  include_extra_guests?: boolean
}

export type SplitPolicyFallback = Omit<SplitPolicyRule, "what">

export type SplitPolicyConfig = {
  rules: SplitPolicyRule[]
  fallback: SplitPolicyFallback
}

export const propertySplitPoliciesTable = pgTable(
  "property_split_policies",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    config: jsonb("config").$type<SplitPolicyConfig>().notNull(),
    created_by_id: integer("created_by_id")
      .notNull()
      .references(() => usersTable.id),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.property_id, t.name)],
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