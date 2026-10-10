import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// docs/brief.md §6.6: double opt-in subscribers. Only a hash of the
// confirm/unsubscribe token is stored.
export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull().unique(),
    status: text().notNull().default("pending"),
    tokenHash: text().unique(),
    tokenExpiresAt: timestamp({ withTimezone: true }),
    sourcePath: text().notNull().default("/"),
    consentText: text().notNull().default(""),
    confirmedAt: timestamp({ withTimezone: true }),
    unsubscribedAt: timestamp({ withTimezone: true }),
    ipHash: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("newsletter_email_lower_check", sql`${t.email} = lower(${t.email})`),
    check(
      "newsletter_status_check",
      sql`${t.status} in ('pending','confirmed','unsubscribed')`
    ),
    index("newsletter_status_created_idx").on(t.status, t.createdAt),
  ]
)
