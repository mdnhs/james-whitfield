import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import { articles } from "./content"

// docs/brief.md §6.6. Phase 5 writes the automatic rows (article slug changes,
// unpublish with a redirect); Phase 7 adds the manager, hit counts and
// site-wide resolution on the same table.
export const redirects = pgTable(
  "redirects",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourcePath: text().notNull().unique(),
    destination: text().notNull(),
    statusCode: integer().notNull().default(301),
    isActive: boolean().notNull().default(true),
    hitCount: integer().notNull().default(0),
    lastHitAt: timestamp({ withTimezone: true }),
    note: text().notNull().default(""),
    // Set on rows the articles service made; Phase 7 shows them as automatic.
    articleId: uuid().references(() => articles.id, { onDelete: "set null" }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "redirects_status_code_check",
      sql`${table.statusCode} in (301, 302, 307, 308)`
    ),
    check(
      "redirects_not_self_check",
      sql`${table.sourcePath} <> ${table.destination}`
    ),
  ]
)
