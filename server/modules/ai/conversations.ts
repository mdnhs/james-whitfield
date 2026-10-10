// server/modules/ai/conversations.ts
import "server-only"

import { randomUUID } from "node:crypto"

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lt,
  notExists,
  or,
  sql,
} from "drizzle-orm"

import {
  textOf,
  textOnly,
  type AiPart,
  type AiUIMessage,
} from "@/lib/ai/messages"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type Tx } from "@/server/db/client"
import { aiConversations, aiMessages, users } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Spec §6: the first message, no extra model call.
export function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length > 60 ? `${t.slice(0, 59).trimEnd()}…` : t
}

export async function createConversation(
  userId: string,
  title: string,
  model: string
) {
  const [row] = await getDb()
    .insert(aiConversations)
    .values({ userId, title, model })
    .returning({ id: aiConversations.id })
  return row!
}

// Ownership is part of the lookup: someone else's id is simply not found.
export async function ownConversation(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1)
  if (!row) throw new ApiError("NOT_FOUND", "That conversation doesn't exist")
  return row
}

export async function appendMessage(
  conversationId: string,
  message: AiUIMessage,
  meta?: {
    tokensIn?: number
    tokensOut?: number
    sharedEnquiryDetails?: boolean
  }
) {
  const now = new Date()
  await getDb().transaction(async (tx) => {
    await tx.insert(aiMessages).values({
      id: UUID.test(message.id) ? message.id : randomUUID(),
      conversationId,
      role: message.role,
      parts: message.parts,
      tokensIn: meta?.tokensIn ?? null,
      tokensOut: meta?.tokensOut ?? null,
      sharedEnquiryDetails: meta?.sharedEnquiryDetails ?? false,
      createdAt: now,
    })
    await tx
      .update(aiConversations)
      .set({ updatedAt: now })
      .where(eq(aiConversations.id, conversationId))
  })
}

// Ruling R8: what the model sees of earlier turns is their text only. Replies
// written while enquiry details were shared stay out once sharing is off
// (or the person can no longer read enquiries).
export async function historyFor(
  conversationId: string,
  limit: number,
  options: { includeShared: boolean }
): Promise<AiUIMessage[]> {
  const rows = await getDb()
    .select()
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        options.includeShared
          ? undefined
          : eq(aiMessages.sharedEnquiryDetails, false)
      )
    )
    .orderBy(desc(aiMessages.createdAt))
    .limit(limit)
  return rows
    .reverse()
    .map((r) =>
      textOnly({
        id: r.id,
        role: r.role as AiUIMessage["role"],
        parts: r.parts as AiPart[],
      })
    )
    .filter((m) => m.parts.length > 0)
}

export const RETENTION_DAYS = 90
const DAY = 86_400_000

export async function listConversations(userId: string) {
  const rows = await getDb()
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      model: aiConversations.model,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(50)
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
}

export async function getConversation(userId: string, id: string) {
  const conv = await ownConversation(userId, id)
  const rows = await getDb()
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(desc(aiMessages.createdAt))
    .limit(200)
  return {
    id: conv.id,
    title: conv.title,
    model: conv.model,
    // The newest 200, oldest first.
    messages: rows.reverse().map((r): AiUIMessage => ({
      id: r.id,
      role: r.role as AiUIMessage["role"],
      parts: r.parts as AiPart[],
    })),
  }
}

export async function deleteConversation(actor: Actor, id: string) {
  await ownConversation(actor.userId, id)
  await getDb().transaction(async (tx) => {
    await tx.delete(aiConversations).where(eq(aiConversations.id, id))
    // Ruling R10: the title is message text, so it stays out of the log.
    await audit(
      actor,
      {
        action: "ai.conversation_delete",
        entityType: "ai_conversation",
        entityId: id,
        summary: "Deleted an AI assistant conversation",
      },
      tx
    )
  })
  return { ok: true as const }
}

// Spec §6: run by the cron tick inside the retention savepoint. Messages
// expire on their own age, so a conversation still in use keeps no text older
// than 90 days. Then conversations left empty, or idle for 90 days, go.
export async function purgeStaleConversations(tx: Tx, now: Date) {
  const before = new Date(now.getTime() - RETENTION_DAYS * DAY)
  const messages = await tx
    .delete(aiMessages)
    .where(lt(aiMessages.createdAt, before))
    .returning({ id: aiMessages.id })
  const conversations = await tx
    .delete(aiConversations)
    .where(
      or(
        lt(aiConversations.updatedAt, before),
        // Empty ones go too, once past the hour in which a new
        // conversation is created and gets its first message.
        and(
          lt(aiConversations.createdAt, new Date(now.getTime() - 3_600_000)),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(aiMessages)
              .where(eq(aiMessages.conversationId, aiConversations.id))
          )
        )
      )
    )
    .returning({ id: aiConversations.id })
  return { conversations: conversations.length, messages: messages.length }
}

// Privacy erase: an enquirer's address can sit in an opted-in saved reply.
// The address as a case-insensitive substring of the stored parts is exact
// enough, and cheap at this size. Conversations left empty go too.
export async function eraseMessagesMentioning(tx: Tx, email: string) {
  const gone = await tx
    .delete(aiMessages)
    .where(
      sql`position(lower(${email}) in lower(${aiMessages.parts}::text)) > 0`
    )
    .returning({ conversationId: aiMessages.conversationId })
  const touched = [...new Set(gone.map((r) => r.conversationId))]
  if (touched.length)
    await tx.delete(aiConversations).where(
      and(
        inArray(aiConversations.id, touched),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(aiMessages)
            .where(eq(aiMessages.conversationId, aiConversations.id))
        )
      )
    )
  return gone.length
}

// DSAR (brief §13): a staff member's own conversations, as readable text.
export async function exportConversationsFor(email: string) {
  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1)
  if (!user) return []
  const convs = await getDb()
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, user.id))
    .orderBy(asc(aiConversations.createdAt))
  return Promise.all(
    convs.map(async (c) => {
      const rows = await getDb()
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, c.id))
        .orderBy(asc(aiMessages.createdAt))
      return {
        title: c.title,
        model: c.model,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messages: rows.map((r) => ({
          role: r.role,
          text: textOf({ parts: r.parts as AiPart[] }),
          createdAt: r.createdAt.toISOString(),
        })),
      }
    })
  )
}
export type ConversationExport = Awaited<
  ReturnType<typeof exportConversationsFor>
>[number]
