import "server-only"

import { and, asc, eq, lte, sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { articles } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, REDIRECT_TAGS } from "@/server/lib/cache"
import { publishLocked } from "@/server/modules/articles/publish"
import { articleTags } from "@/server/modules/articles/service"
import { defer } from "@/server/lib/defer"
import { maybeReply } from "@/server/modules/chat/bot"
import { notifyNoReply } from "@/server/modules/chat/notify"
import { chatSweep } from "@/server/modules/chat/sweep"
import { purgeExpired } from "@/server/modules/leads/retention"

// pg advisory lock key for the tick ("mkti").
export const TICK_LOCK_KEY = 0x6d6b7469

const NO_PURGE = {
  closed: 0,
  spam: 0,
  pendingSubscribers: 0,
  rateLimits: 0,
  aiConversations: 0,
  aiMessages: 0,
  chats: 0,
}

// docs/brief.md §5.5(f). One transaction holds the lock; due rows are locked
// FOR UPDATE (skip locked) and each publishes in its own savepoint so one
// broken draft cannot block the rest. The retention purge runs last, in its own savepoint.
export async function runTick(now = new Date()) {
  const toExpire: string[] = []
  const alertIds: string[] = []
  const resumeIds: string[] = []
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
        chat: { alerted: 0, resumed: 0, autoClosed: 0 },
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
    // Chat alerts, bot recovery and auto-close: own savepoint, emails and
    // bot replies run after commit.
    let chat = { alerted: 0, resumed: 0, autoClosed: 0 }
    try {
      const swept = await tx.transaction((sp) => chatSweep(sp, now))
      alertIds.push(...swept.alerted)
      resumeIds.push(...swept.resumed)
      chat = {
        alerted: swept.alerted.length,
        resumed: swept.resumed.length,
        autoClosed: swept.autoClosed,
      }
    } catch (error) {
      console.error("[scheduler] chat sweep failed", error)
    }
    // A savepoint, so a purge error cannot undo published articles.
    let purged = { ...NO_PURGE }
    try {
      purged = await tx.transaction((sp) => purgeExpired(sp, now))
    } catch (error) {
      console.error("[scheduler] retention purge failed", error)
    }
    return { skipped: false, published, failed, purged, chat }
  })
  if (toExpire.length) invalidate(toExpire)
  for (const id of alertIds) {
    notifyNoReply(id).catch((error) =>
      console.error("[scheduler] no-reply alert failed", error)
    )
  }
  for (const id of resumeIds) {
    try {
      defer(() => maybeReply(id), "chat recovery")
    } catch {
      // Outside a request scope (no `after`): run it directly.
      maybeReply(id).catch((error) =>
        console.error("[scheduler] chat recovery failed", error)
      )
    }
  }
  return result
}
