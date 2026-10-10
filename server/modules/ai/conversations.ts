// server/modules/ai/conversations.ts
import "server-only"

import { randomUUID } from "node:crypto"

import { and, desc, eq } from "drizzle-orm"

import { textOnly, type AiPart, type AiUIMessage } from "@/lib/ai/messages"
import { ApiError } from "@/server/api/errors"
import { getDb } from "@/server/db/client"
import { aiConversations, aiMessages } from "@/server/db/schema"

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
  tokens?: { tokensIn: number; tokensOut: number }
) {
  const now = new Date()
  await getDb().transaction(async (tx) => {
    await tx.insert(aiMessages).values({
      id: UUID.test(message.id) ? message.id : randomUUID(),
      conversationId,
      role: message.role,
      parts: message.parts,
      tokensIn: tokens?.tokensIn ?? null,
      tokensOut: tokens?.tokensOut ?? null,
      createdAt: now,
    })
    await tx
      .update(aiConversations)
      .set({ updatedAt: now })
      .where(eq(aiConversations.id, conversationId))
  })
}

// Ruling R8: what the model sees of earlier turns is their text only.
export async function historyFor(
  conversationId: string,
  limit: number
): Promise<AiUIMessage[]> {
  const rows = await getDb()
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
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
