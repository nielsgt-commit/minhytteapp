import {
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { usersTable } from "./users.schema.ts"

export const sessionsTable = pgTable("sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  expires_at: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  user_id: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
})

export const accountsTable = pgTable("accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  account_id: text("account_id").notNull(),
  provider_id: text("provider_id").notNull(),
  user_id: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  access_token: text("access_token"),
  refresh_token: text("refresh_token"),
  id_token: text("id_token"),
  access_token_expires_at: timestamp("access_token_expires_at"),
  refresh_token_expires_at: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
})

export const verificationsTable = pgTable("verifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
})
