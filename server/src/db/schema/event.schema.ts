import { pgTable, integer, varchar } from "drizzle-orm/pg-core"


export const eventsSchema = pgTable('events',{
  id: integer('id').primaryKey(),
  name: varchar('name',{length:255}).notNull(),
  description: varchar('description',{length:255}).notNull(),
  timestamp: varchar('timestamp',{length:255}).notNull(),
  authors: varchar('authors',{length:255}).notNull(),

})