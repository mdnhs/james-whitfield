import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

// Fixed-window counters for the public API (docs/brief.md §6.6).
export const apiRateLimits = pgTable(
  "api_rate_limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    resetAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("api_rate_limits_reset_idx").on(t.resetAt)]
)
