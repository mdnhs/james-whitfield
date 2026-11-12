import "server-only"

import { and, desc, eq, getTableColumns, sql } from "drizzle-orm"

import { getDb, type DbLike } from "@/server/db/client"
import {
  chatConversations,
  chatMessages,
  chatPresence,
  users,
} from "@/server/db/schema"

export type ChatRow = typeof chatConversations.$inferSelect
export type ChatMessageRow = typeof chatMessages.$inferSelect
export type ChatListRow = ChatRow & { unread: boolean }
export type Sender = "visitor" | "staff" | "ai" | "system"
export type NoticeKind = "handoff" | "limit" | "failed" | "crisis"

const MAX_VISITOR_MESSAGES = 300
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------- conversations ----------

export async function createConversation(
  input: {
    tokenHash: string
    name: string
    email: string | null
    sourcePath: string | null
    firstMessage: string
  },
  db: DbLike = getDb()
): Promise<ChatRow> {
  return db.transaction(async (tx) => {
    // DB clock only: now() is constant inside the transaction, so the
    // conversation timestamps equal the first message's created_at.
    const now = sql`now()`
    const [chat] = await tx
      .insert(chatConversations)
      .values({
        tokenHash: input.tokenHash,
        visitorName: input.name,
        visitorEmail: input.email,
        sourcePath: input.sourcePath,
        consentAt: now,
        messageCount: 1,
        lastMessageAt: now,
        lastVisitorMessageAt: now,
      })
      .returning()
    await tx.insert(chatMessages).values({
      conversationId: chat!.id,
      sender: "visitor",
      senderName: input.name,
      body: input.firstMessage,
      createdAt: now,
    })
    return chat!
  })
}

export async function byTokenHash(
  hash: string,
  db: DbLike = getDb()
): Promise<ChatRow | null> {
  const [row] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.tokenHash, hash))
  return row ?? null
}

export async function byId(
  id: string,
  db: DbLike = getDb()
): Promise<ChatRow | null> {
  const [row] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
  return row ?? null
}

// ---------- messages ----------

export async function messagesAfter(
  conversationId: string,
  afterId: number,
  limit = 200,
  db: DbLike = getDb()
): Promise<ChatMessageRow[]> {
  return db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        sql`${chatMessages.id} > ${afterId}`
      )
    )
    .orderBy(chatMessages.id)
    .limit(limit)
}

type MessageSqlRow = {
  id: number | string
  conversation_id: string
  sender: Sender
  sender_name: string | null
  body: string
  notice_kind: string | null
  created_at: Date | string
}

// One statement: the guarded UPDATE locks the conversation and bumps its
// counters; the INSERT only runs from that CTE's row, so a refused guard
// writes nothing. A repeated notice is skipped up front (not exists) so the
// counters are not bumped; the ON CONFLICT is the backstop for a concurrent
// duplicate (which may over-count by one, harmlessly).
export async function addMessage(
  input: {
    conversationId: string
    sender: Sender
    body: string
    senderName?: string | null
    noticeKind?: NoticeKind | null
    requireOpen?: boolean
    requireBotOwns?: boolean
  },
  db: DbLike = getDb()
): Promise<ChatMessageRow | null> {
  const requireOpen = input.requireOpen ?? true
  const noticeKind = input.noticeKind ?? null
  const senderName = input.senderName ?? null
  const isVisitor = input.sender === "visitor"
  const isReply = input.sender === "staff" || input.sender === "ai"

  const guards = [
    requireOpen ? sql`and c.status = 'open'` : sql``,
    input.requireBotOwns
      ? sql`and c.ai_enabled and not c.needs_human and c.assigned_to is null`
      : sql``,
    isVisitor ? sql`and c.message_count < ${MAX_VISITOR_MESSAGES}` : sql``,
    noticeKind
      ? sql`and not exists (
          select 1 from chat_messages n
          where n.conversation_id = c.id and n.notice_kind = ${noticeKind})`
      : sql``,
  ]

  const { rows } = await db.execute<MessageSqlRow>(sql`
    with bumped as (
      update chat_conversations c set
        message_count = c.message_count + 1,
        last_message_at = now(),
        last_visitor_message_at = ${isVisitor ? sql`now()` : sql`c.last_visitor_message_at`},
        last_reply_at = ${isReply ? sql`now()` : sql`c.last_reply_at`},
        ai_reply_count = c.ai_reply_count + ${input.sender === "ai" ? 1 : 0}
      where c.id = ${input.conversationId}
      ${sql.join(guards, sql` `)}
      returning c.id
    )
    insert into chat_messages (conversation_id, sender, sender_name, body, notice_kind)
    select bumped.id, ${input.sender}, ${senderName}, ${input.body}, ${noticeKind}
    from bumped
    on conflict (conversation_id, notice_kind) where notice_kind is not null
    do nothing
    returning *`)
  const row = rows[0]
  if (!row) return null
  return {
    id: Number(row.id),
    conversationId: row.conversation_id,
    sender: row.sender,
    senderName: row.sender_name,
    body: row.body,
    noticeKind: row.notice_kind,
    createdAt: new Date(row.created_at),
  }
}

export async function recentForModel(
  id: string,
  limit = 20,
  db: DbLike = getDb()
): Promise<{ sender: "visitor" | "staff" | "ai"; body: string }[]> {
  const rows = await db
    .select({ sender: chatMessages.sender, body: chatMessages.body })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, id),
        sql`${chatMessages.sender} <> 'system'`
      )
    )
    .orderBy(desc(chatMessages.id))
    .limit(limit)
  return rows.reverse().map((r) => ({
    sender: r.sender as "visitor" | "staff" | "ai",
    body: r.body,
  }))
}

// ---------- bot lease ----------

// A single conditional UPDATE: concurrent claims serialise on the row lock and
// the loser re-checks the predicate against the winner's new lease.
export async function claimLease(
  id: string,
  ms = 60_000,
  db: DbLike = getDb()
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    update chat_conversations
    set ai_lease_until = now() + (${ms}::numeric * interval '1 millisecond')
    where id = ${id}
      and (ai_lease_until is null or ai_lease_until < now())
    returning id`)
  return rows.length > 0
}

export async function releaseLease(
  id: string,
  db: DbLike = getDb()
): Promise<void> {
  await db
    .update(chatConversations)
    .set({ aiLeaseUntil: null })
    .where(eq(chatConversations.id, id))
}

// ---------- flags and assignment ----------

export async function assigneeName(
  userId: string,
  db: DbLike = getDb()
): Promise<string | null> {
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
  return row?.name ?? null
}

export async function flagNeedsHuman(
  id: string,
  db: DbLike = getDb()
): Promise<boolean> {
  const rows = await db
    .update(chatConversations)
    .set({ needsHuman: true })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.needsHuman, false))
    )
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

export async function setAi(
  id: string,
  enabled: boolean,
  db: DbLike = getDb()
): Promise<ChatRow | null> {
  const [row] = await db
    .update(chatConversations)
    .set(
      enabled ? { aiEnabled: true, needsHuman: false } : { aiEnabled: false }
    )
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning()
  return row ?? null
}

// Requires an open chat, like setAi: nobody is assigned to a finished chat.
export async function assign(
  id: string,
  userId: string | null,
  db: DbLike = getDb()
): Promise<ChatRow | null> {
  const [row] = await db
    .update(chatConversations)
    .set({ assignedTo: userId })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning()
  return row ?? null
}

// Transition-only: returns the row only when this call closed it, null when it
// was already closed, so callers add the "ended" notice exactly once.
export async function close(
  id: string,
  db: DbLike = getDb()
): Promise<ChatRow | null> {
  const [row] = await db
    .update(chatConversations)
    .set({
      status: "closed",
      closedAt: sql`coalesce(${chatConversations.closedAt}, now())`,
      aiLeaseUntil: null,
    })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning()
  return row ?? null
}

export async function remove(
  id: string,
  db: DbLike = getDb()
): Promise<boolean> {
  const rows = await db
    .delete(chatConversations)
    .where(eq(chatConversations.id, id))
    .returning({ id: chatConversations.id })
  return rows.length > 0
}

export async function setVisitorEmail(
  id: string,
  email: string,
  db: DbLike = getDb()
): Promise<ChatRow | null> {
  const [row] = await db
    .update(chatConversations)
    .set({ visitorEmail: email })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.status, "open"))
    )
    .returning()
  return row ?? null
}

// Never moves backwards and never uses now(): a message the staff member has
// not seen yet must keep the chat unread.
export async function markRead(
  id: string,
  upToMessageId: number,
  db: DbLike = getDb()
): Promise<void> {
  await db.execute(sql`
    update chat_conversations c
    set staff_read_at = greatest(coalesce(c.staff_read_at, m.created_at), m.created_at)
    from chat_messages m
    where c.id = ${id} and m.id = ${upToMessageId} and m.conversation_id = c.id`)
}

// ---------- lists and presence ----------

const unreadExpr = sql<boolean>`coalesce(${chatConversations.lastVisitorMessageAt} > coalesce(${chatConversations.staffReadAt}, 'epoch'::timestamptz), false)`
// Millisecond precision so the cursor (a JS-safe string) round-trips exactly.
const sortAt = sql`date_trunc('milliseconds', ${chatConversations.lastMessageAt})`

export async function listForStaff(
  opts: { status: "open" | "closed"; cursor?: string; limit: number },
  db: DbLike = getDb()
): Promise<{ items: ChatListRow[]; next: string | null }> {
  const conditions = [eq(chatConversations.status, opts.status)]
  if (opts.cursor) {
    const [at, cid] = opts.cursor.split("|")
    if (at && cid && !Number.isNaN(Date.parse(at)) && UUID_RE.test(cid)) {
      conditions.push(
        sql`(${sortAt}, ${chatConversations.id}) < (${new Date(at)}::timestamptz, ${cid}::uuid)`
      )
    }
  }
  const rows = await db
    .select({ ...getTableColumns(chatConversations), unread: unreadExpr })
    .from(chatConversations)
    .where(and(...conditions))
    .orderBy(desc(sortAt), desc(chatConversations.id))
    .limit(opts.limit + 1)
  const items = rows.slice(0, opts.limit)
  const last = items[items.length - 1]
  const next =
    rows.length > opts.limit && last
      ? `${last.lastMessageAt.toISOString()}|${last.id}`
      : null
  return { items, next }
}

export async function unreadCount(db: DbLike = getDb()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatConversations)
    .where(and(eq(chatConversations.status, "open"), unreadExpr))
  return row?.n ?? 0
}

export async function touchPresence(
  userId: string,
  db: DbLike = getDb()
): Promise<void> {
  await db
    .insert(chatPresence)
    .values({ userId, seenAt: sql`now()` })
    .onConflictDoUpdate({
      target: chatPresence.userId,
      set: { seenAt: sql`now()` },
    })
}

export async function staffOnline(
  withinMs = 120_000,
  db: DbLike = getDb()
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    select 1 from chat_presence
    where seen_at > now() - (${withinMs}::numeric * interval '1 millisecond')
    limit 1`)
  return rows.length > 0
}
