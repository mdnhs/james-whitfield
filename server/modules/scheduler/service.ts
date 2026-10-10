import "server-only"

import { and, asc, eq, lte, sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { articles } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, REDIRECT_TAGS } from "@/server/lib/cache"
import { publishLocked } from "@/server/modules/articles/publish"
import { articleTags } from "@/server/modules/articles/service"
import { purgeExpired } from "@/server/modules/leads/retention"

// pg advisory lock key for the tick ("mkti").
export const TICK_LOCK_KEY = 0x6d6b7469

const NO_PURGE = {
  closed: 0,
  spam: 0,
  pendingSubscribers: 0,
  rateLimits: 0,
}

// docs/brief.md §5.5(f). One transaction holds the lock; due rows are locked
// FOR UPDATE (skip locked) and each publishes in its own savepoint so one
// broken draft cannot block the rest. The retention purge runs last, in its own savepoint.
export async function runTick(now = new Date()) {
  const toExpire: string[] = []
  const result = await getDb().transaction(async (tx) => {
    const { rows } = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${TICK_LOCK_KEY}) as locked`
    )
    if (!rows[0]?.locked) {
      return {
        skipped: true,
        published: [] as string[],
        failed: [] as string[],
        purged: { ...NO_PURGE },
      }
    }
    const due = await tx
      .select()
      .from(articles)
      .where(
        and(eq(articles.status, "scheduled"), lte(articles.scheduledFor, now))
      )
      .orderBy(asc(articles.scheduledFor))
      .for("update", { skipLocked: true })
    const published: string[] = []
    const failed: string[] = []
    for (const row of due) {
      try {
        const { redirectsChanged } = await tx.transaction((sp) =>
          publishLocked(sp, row, null)
        )
        published.push(row.id)
        toExpire.push(
          ...articleTags(row.id, redirectsChanged ? [...REDIRECT_TAGS] : [])
        )
      } catch (error) {
        // Ruling R5: back to draft so it is fixed by a person, not retried.
        console.error(
          `[scheduler] article ${row.id} could not be published`,
          error
        )
        await tx
          .update(articles)
          .set({ status: "draft", scheduledFor: null, scheduledBy: null })
          .where(eq(articles.id, row.id))
        await audit(
          null,
          {
            action: "article.schedule_failed",
            entityType: "article",
            entityId: row.id,
            summary: `“${row.title}” was not published on schedule: its draft has errors`,
          },
          tx
        )
        failed.push(row.id)
      }
    }
    // A savepoint, so a purge error cannot undo published articles.
    let purged = { ...NO_PURGE }
    try {
      purged = await tx.transaction((sp) => purgeExpired(sp, now))
    } catch (error) {
      console.error("[scheduler] retention purge failed", error)
    }
    return { skipped: false, published, failed, purged }
  })
  if (toExpire.length) invalidate(toExpire)
  return result
}
