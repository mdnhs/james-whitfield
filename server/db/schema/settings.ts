import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// One row per global document (docs/brief.md §6.4). `value` is validated by
// the owning module's Zod schema; `draft` is only used by the theme.
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  draft: jsonb().$type<unknown>(),
  version: integer().notNull().default(1),
  // Attribution only. The users table arrives in Task 1.3, and the audit log
  // is the source of truth for who changed what.
  updatedBy: uuid(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
