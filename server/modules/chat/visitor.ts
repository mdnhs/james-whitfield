import "server-only"

import { createHash, randomBytes } from "node:crypto"

import type {
  ChatStatus,
  EmailInput,
  StartChatInput,
  VisitorView,
} from "@/lib/chat/schema"
import { ChatGlobal } from "@/lib/content/globals"
import { ApiError } from "@/server/api/errors"
import { hashIp } from "@/server/lib/crypto"
import { defer } from "@/server/lib/defer"
import { hitLimit } from "@/server/lib/rate-limit-db"
import { turnstileEnabled, turnstileSiteKey } from "@/server/lib/turnstile"
import { getGlobal } from "@/server/modules/globals/service"

import * as bot from "./bot"
import * as repo from "./repo"

export const CHAT_COOKIE = "mk_chat"
export const CHAT_COOKIE_PATH = "/api/v1/public/chat"
export const CHAT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

export const START_LIMIT = { limit: 5, windowMs: 10 * 60_000 }
export const START_SITE_LIMIT = { limit: 60, windowMs: 60 * 60_000 }
export const SEND_IP_LIMIT = { limit: 20, windowMs: 60_000 }
export const SEND_CHAT_LIMIT = { limit: 60, windowMs: 60 * 60_000 }
export const POLL_LIMIT = { limit: 120, windowMs: 60_000 }

const ENDED_NOTICE = "This chat has ended."
const tooMany = () =>
  new ApiError("RATE_LIMITED", "Too many messages. Try again later.")
const ended = () => new ApiError("CONFLICT", "This chat has ended")

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")
export const newToken = () => randomBytes(32).toString("base64url")

// Empty saved strings fall back to the schema defaults.
export async function readChatSettings() {
  const { value } = await getGlobal("chat")
  const d = ChatGlobal.parse({})
  return {
    enabled: value.enabled,
    welcome: value.welcome || d.welcome,
    offlineNote: value.offlineNote || d.offlineNote,
    botName: value.bot.name || d.bot.name,
  }
}

// 404 when the chat is switched off: the widget never learns it exists.
export async function requireEnabled() {
  const settings = await readChatSettings()
  if (!settings.enabled) throw new ApiError("NOT_FOUND", "Not found")
  return settings
}

export async function status(): Promise<ChatStatus> {
  const settings = await requireEnabled()
  const [online, botActive] = await Promise.all([
    repo.staffOnline(),
    bot.isActive(),
  ])
  return {
    enabled: true,
    online,
    botActive,
    welcome: settings.welcome,
    offlineNote: settings.offlineNote,
    botName: settings.botName,
    turnstileSiteKey: turnstileEnabled() ? turnstileSiteKey() : null,
  }
}

export async function findByToken(token: string | undefined) {
  if (!token) return null
  return repo.byTokenHash(hashToken(token))
}

export async function requireChat(token: string | undefined) {
  const chat = await findByToken(token)
  if (!chat) throw new ApiError("NOT_FOUND", "Chat not found")
  return chat
}

async function botOwns(chat: repo.ChatRow) {
  return (
    chat.status === "open" &&
    chat.aiEnabled &&
    !chat.needsHuman &&
    !chat.assignedTo &&
    (await bot.isActive())
  )
}

export async function view(
  chat: repo.ChatRow,
  afterId = 0
): Promise<VisitorView> {
  const [rows, botActive, agentName] = await Promise.all([
    repo.messagesAfter(chat.id, afterId),
    botOwns(chat),
    chat.assignedTo ? repo.assigneeName(chat.assignedTo) : null,
  ])
  return {
    id: chat.id,
    status: chat.status as VisitorView["status"],
    botActive,
    needsHuman: chat.needsHuman,
    agentName,
    messages: rows.map((m) => ({
      id: m.id,
      sender: m.sender as VisitorView["messages"][number]["sender"],
      senderName: m.senderName,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
    lastId: rows.at(-1)?.id ?? afterId,
  }
}

export async function pollLimit(ip: string) {
  const r = await hitLimit(`chat:poll:ip:${hashIp(ip)}`, POLL_LIMIT)
  if (!r.allowed) throw tooMany()
}

export async function siteStartLimit() {
  const r = await hitLimit("chat:start:site", START_SITE_LIMIT)
  if (!r.allowed) {
    throw new ApiError("RATE_LIMITED", "Too many chats right now. Try later.")
  }
}

export async function start(input: StartChatInput) {
  const token = newToken()
  const chat = await repo.createConversation({
    tokenHash: hashToken(token),
    name: input.name,
    email: input.email || null,
    sourcePath: input.sourcePath ?? null,
    firstMessage: input.message,
  })
  const v = await view(chat)
  if (v.botActive) defer(() => bot.maybeReply(chat.id), "chat bot reply")
  return { token, view: v }
}

export async function send(chat: repo.ChatRow, body: string, ip: string) {
  if (chat.status !== "open") throw ended()
  const byIp = await hitLimit(`chat:send:ip:${hashIp(ip)}`, SEND_IP_LIMIT)
  const byChat = await hitLimit(`chat:send:chat:${chat.id}`, SEND_CHAT_LIMIT)
  if (!byIp.allowed || !byChat.allowed) throw tooMany()
  const row = await repo.addMessage({
    conversationId: chat.id,
    sender: "visitor",
    senderName: chat.visitorName,
    body,
  })
  const fresh = await repo.byId(chat.id)
  if (!row) {
    // A guard refused: the chat closed meanwhile, or hit the 300 cap.
    if (!fresh || fresh.status !== "open") throw ended()
    throw new ApiError(
      "RATE_LIMITED",
      "This chat has reached its message limit"
    )
  }
  if (fresh && (await botOwns(fresh))) {
    defer(() => bot.maybeReply(chat.id), "chat bot reply")
  }
  return row
}

export async function setEmail(chat: repo.ChatRow, input: EmailInput) {
  const row = await repo.setVisitorEmail(chat.id, input.email)
  if (!row) throw ended()
}

export async function end(chat: repo.ChatRow) {
  if (chat.status !== "open") return
  await repo.close(chat.id)
  await repo.addMessage({
    conversationId: chat.id,
    sender: "system",
    body: ENDED_NOTICE,
    requireOpen: false,
  })
}
