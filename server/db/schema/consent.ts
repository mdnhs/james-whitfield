import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// docs/brief.md §6.6 / §12.2: append-only proof of consent. No IP, no user.
export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    consentId: uuid().notNull(),
    analytics: boolean().notNull(),
    marketing: boolean().notNull(),
    revision: integer().notNull(),
    bannerHash: text().notNull(),
    action: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "consent_events_action_check",
      sql`${t.action} in ('accept','reject','custom','withdraw')`
    ),
    index("consent_events_consent_idx").on(t.consentId, t.createdAt),
  ]
)
