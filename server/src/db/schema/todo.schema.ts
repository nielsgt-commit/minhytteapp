import {
  boolean,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { propertyTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

export const todosTable = pgTable("todos", {
  id: serial("id").primaryKey(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  description: varchar("description", { length: 255 }).notNull(),
  done: boolean("done").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  created_by: integer("created_by").references(() => usersTable.id),
})

// One row per user assigned to a todo. Cascade so deleting a todo (including
// the delete inside moveToMaintenance) takes its assignments with it.
export const todoAssigneesTable = pgTable(
  "todo_assignees",
  {
    id: serial("id").primaryKey(),
    todo_id: integer("todo_id")
      .notNull()
      .references(() => todosTable.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("todo_assignee_uq").on(t.todo_id, t.user_id)],
)
