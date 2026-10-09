import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"

// Who changed what, when (docs/brief.md §6.6). Never store enquiry content.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    actorEmail: text(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    summary: text().notNull(),
    diff: jsonb().$type<Record<string, { from: unknown; to: unknown }>>(),
    ipHash: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt.desc()),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ]
)
