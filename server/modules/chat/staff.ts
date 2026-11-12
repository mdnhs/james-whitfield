import "server-only"

import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { audit } from "@/server/lib/audit"
import { defer } from "@/server/lib/defer"

import { maybeReply } from "./bot"
import * as repo from "./repo"

const PAGE = 30
const ENTITY = "chat"

// Never sends the token hash or the bot lease to the browser.
function toStaff(chat: repo.ChatRow) {
  const { tokenHash: _hash, aiLeaseUntil: _lease, ...rest } = chat
  void _hash
  void _lease
  return rest
}

async function load(id: string) {
  const chat = await repo.byId(id)
  if (!chat) throw new ApiError("NOT_FOUND", "Chat not found")
  return chat
}

const closedError = () => new ApiError("CONFLICT", "This chat has ended")

export async function list(opts: {
  status: "open" | "closed"
  cursor?: string
}) {
  const { items, next } = await repo.listForStaff({ ...opts, limit: PAGE })
  return { items: items.map(toStaff), next }
}

export async function unread() {
  return { count: await repo.unreadCount() }
}

export async function detail(id: string, after: number) {
  const chat = await load(id)
  const [messages, assignee] = await Promise.all([
    repo.messagesAfter(id, after),
    chat.assignedTo ? repo.assigneeName(chat.assignedTo) : null,
  ])
  return { chat: toStaff(chat), assigneeName: assignee, messages }
}

// Turns the bot off and assigns an unassigned chat to the actor. The join
// notice is added only when this call made that assignment, so a second reply
// from the same person adds nothing.
async function claim(actor: Actor, id: string) {
  const before = await load(id)
  if (before.status !== "open") throw closedError()
  const updated = await repo.setAi(id, false)
  if (!updated) throw closedError()
  if (before.assignedTo === null) {
    const assigned = await repo.assign(id, actor.userId)
    if (!assigned) throw closedError()
    await repo.addMessage({
      conversationId: id,
      sender: "system",
      body: `${actor.name} joined the chat.`,
    })
    return { chat: assigned, joined: true }
  }
  return { chat: updated, joined: false }
}

export async function reply(actor: Actor, id: string, body: string) {
  await claim(actor, id)
  const message = await repo.addMessage({
    conversationId: id,
    sender: "staff",
    senderName: actor.name,
    body,
  })
  if (!message) throw closedError()
  await audit(actor, {
    action: "chat.reply",
    entityType: ENTITY,
    entityId: id,
    summary: "Replied in a live chat",
  })
  return message
}

export async function takeover(actor: Actor, id: string) {
  const { chat, joined } = await claim(actor, id)
  await audit(actor, {
    action: "chat.takeover",
    entityType: ENTITY,
    entityId: id,
    summary: joined
      ? "Took over a live chat"
      : "Took over a live chat (already assigned)",
  })
  return { chat: toStaff(chat) }
}

export async function handback(actor: Actor, id: string) {
  const before = await load(id)
  if (before.status !== "open") throw closedError()
  if (before.assignedTo !== null && before.assignedTo !== actor.userId) {
    throw new ApiError("CONFLICT", "Another team member is on this chat")
  }
  if (before.assignedTo !== null && !(await repo.assign(id, null))) {
    throw closedError()
  }
  const chat = await repo.setAi(id, true)
  if (!chat) throw closedError()
  await repo.addMessage({
    conversationId: id,
    sender: "system",
    body: "The assistant is back on this chat.",
  })
  await audit(actor, {
    action: "chat.handback",
    entityType: ENTITY,
    entityId: id,
    summary: "Handed a live chat back to the assistant",
  })
  defer(() => maybeReply(id), "chat.handback")
  return { chat: toStaff(chat) }
}

export async function assign(actor: Actor, id: string, userId: string | null) {
  const before = await load(id)
  if (before.status !== "open") throw closedError()
  let name: string | null = null
  if (userId) {
    name = await repo.assigneeName(userId)
    if (name === null) throw new ApiError("NOT_FOUND", "User not found")
  }
  const chat = await repo.assign(id, userId)
  if (!chat) throw closedError()
  await audit(actor, {
    action: "chat.assign",
    entityType: ENTITY,
    entityId: id,
    summary: name
      ? `Assigned a live chat to ${name}`
      : "Unassigned a live chat",
    diff: { assignedTo: { from: before.assignedTo, to: userId } },
  })
  return { chat: toStaff(chat), assigneeName: name }
}

export async function read(id: string, upTo: number) {
  await load(id)
  await repo.markRead(id, upTo)
  return { ok: true }
}

export async function close(actor: Actor, id: string) {
  await load(id)
  const closed = await repo.close(id)
  if (closed) {
    await repo.addMessage({
      conversationId: id,
      sender: "system",
      body: "This chat has ended.",
      requireOpen: false,
    })
    await audit(actor, {
      action: "chat.close",
      entityType: ENTITY,
      entityId: id,
      summary: "Closed a live chat",
    })
  }
  return { ok: true }
}

export async function remove(actor: Actor, id: string) {
  if (!(await repo.remove(id)))
    throw new ApiError("NOT_FOUND", "Chat not found")
  await audit(actor, {
    action: "chat.delete",
    entityType: ENTITY,
    entityId: id,
    summary: "Deleted a live chat",
  })
  return { ok: true }
}
