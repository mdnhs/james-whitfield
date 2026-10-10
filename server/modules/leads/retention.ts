import "server-only"

import { and, eq, isNull, lt, or } from "drizzle-orm"

import { parseGlobal } from "@/lib/content/globals"
import type { Tx } from "@/server/db/client"
import {
  apiRateLimits,
  leads,
  newsletterSubscribers,
  settings,
} from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

const DAY = 86_400_000
const PENDING_DAYS = 30
const RATE_LIMIT_GRACE_DAYS = 1

// Ruling R12 (overridden by the final review: spam and closed both age from
// status_changed_at, so marking an old lead as spam never deletes it at once): every tick, under the scheduler lock; the windows come from the
// privacy global (docs/brief.md §13 retention defaults).
export async function purgeExpired(tx: Tx, now: Date) {
  const [row] = await tx
    .select()
    .from(settings)
    .where(eq(settings.key, "privacy"))
    .limit(1)
  const privacy = parseGlobal("privacy", row?.value)
  const closedBefore = new Date(now)
  closedBefore.setUTCMonth(
    closedBefore.getUTCMonth() - privacy.enquiryRetentionMonths
  )
  const spamBefore = new Date(now.getTime() - privacy.spamRetentionDays * DAY)
  const pendingBefore = new Date(now.getTime() - PENDING_DAYS * DAY)
  const count = (rows: unknown[]) => rows.length
  const closed = count(
    await tx
      .delete(leads)
      .where(
        and(eq(leads.status, "closed"), lt(leads.statusChangedAt, closedBefore))
      )
      .returning({ id: leads.id })
  )
  const spam = count(
    await tx
      .delete(leads)
      .where(
        and(eq(leads.status, "spam"), lt(leads.statusChangedAt, spamBefore))
      )
      .returning({ id: leads.id })
  )
  const pendingSubscribers = count(
    await tx
      .delete(newsletterSubscribers)
      .where(
        and(
          eq(newsletterSubscribers.status, "pending"),
          // A re-subscribe keeps created_at but issues a fresh token, so the
          // token expiry (not the signup date) marks a pending row as stale.
          or(
            lt(newsletterSubscribers.tokenExpiresAt, pendingBefore),
            and(
              isNull(newsletterSubscribers.tokenExpiresAt),
              lt(newsletterSubscribers.updatedAt, pendingBefore)
            )
          )
        )
      )
      .returning({ id: newsletterSubscribers.id })
  )
  // Spent fixed windows: kept a day past their end, then dropped.
  const rateLimits = count(
    await tx
      .delete(apiRateLimits)
      .where(
        lt(
          apiRateLimits.resetAt,
          new Date(now.getTime() - RATE_LIMIT_GRACE_DAYS * DAY)
        )
      )
      .returning({ key: apiRateLimits.key })
  )
  if (closed + spam + pendingSubscribers > 0) {
    await audit(
      null,
      {
        action: "lead.purge",
        entityType: "lead",
        summary: `Retention purge: ${closed} closed and ${spam} spam enquiries, ${pendingSubscribers} unconfirmed subscriptions`,
      },
      tx
    )
  }
  return { closed, spam, pendingSubscribers, rateLimits }
}
