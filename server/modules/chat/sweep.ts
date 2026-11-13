import "server-only"

import { sql } from "drizzle-orm"

import type { Tx } from "@/server/db/client"

import * as repo from "./repo"

const ENDED_NOTICE = "This chat has ended."

// Bot-owned = open, AI on, not flagged, unassigned (same rule as the repo).
const BOT_OWNED = sql`(c.ai_enabled and not c.needs_human and c.assigned_to is null)`
const LEASE_FREE = sql`(c.ai_lease_until is null or c.ai_lease_until < now())`

type IdRow = { id: string }

// Tick work for live chat, run inside the scheduler transaction. Every
// comparison uses the DB clock (like the repo), so the JS `now` is unused.
// Emails (`alerted`) and deferred bot replies (`resumed`) are the caller's job,
// after the transaction commits.
export async function chatSweep(
  tx: Tx,
  _now: Date
): Promise<{
  alerted: string[]
  resumed: string[]
  autoClosed: number
}> {
  void _now
  // Auto-close first, so a chat that just ended is never alerted or resumed.
  const closed = await tx.execute<IdRow>(sql`
    update chat_conversations c set
      status = 'closed',
      closed_at = coalesce(c.closed_at, now()),
      ai_lease_until = null
    where c.status = 'open'
      and c.last_message_at < now() - interval '24 hours'
    returning c.id`)
  for (const { id } of closed.rows) {
    await repo.addMessage(
      {
        conversationId: id,
        sender: "system",
        body: ENDED_NOTICE,
        requireOpen: false,
      },
      tx
    )
  }

  // One no-reply alert per waiting episode.
  const alerted = await tx.execute<IdRow>(sql`
    update chat_conversations c set no_reply_alerted_at = now()
    where c.status = 'open'
      and c.last_visitor_message_at < now() - interval '5 minutes'
      and c.last_visitor_message_at > coalesce(c.last_reply_at, 'epoch'::timestamptz)
      and (c.no_reply_alerted_at is null
           or c.no_reply_alerted_at < c.last_visitor_message_at)
      and (not ${BOT_OWNED} or ${LEASE_FREE})
    returning c.id`)

  // Stalled bot: the visitor spoke last, over 90 s ago, and no one holds the lease.
  const resumed = await tx.execute<IdRow>(sql`
    select c.id from chat_conversations c
    where c.status = 'open'
      and ${BOT_OWNED}
      and ${LEASE_FREE}
      and c.last_visitor_message_at is not null
      and c.last_visitor_message_at >= c.last_message_at
      and c.last_visitor_message_at > coalesce(c.last_reply_at, 'epoch'::timestamptz)
      and c.last_visitor_message_at < now() - interval '90 seconds'`)

  return {
    alerted: alerted.rows.map((r) => r.id),
    resumed: resumed.rows.map((r) => r.id),
    autoClosed: closed.rows.length,
  }
}
