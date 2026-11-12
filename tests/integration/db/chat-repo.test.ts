import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { chatConversations, chatMessages } from "@/server/db/schema"
import * as repo from "@/server/modules/chat/repo"

import { createUser } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

let n = 0
async function start(
  overrides: Partial<Parameters<typeof repo.createConversation>[0]> = {}
) {
  n += 1
  return repo.createConversation({
    tokenHash: `hash-${n}`,
    name: "Aoife",
    email: null,
    sourcePath: "/services",
    firstMessage: "Hello there",
    ...overrides,
  })
}

describe("chat repository", () => {
  it("(a) creates a conversation and finds it by token hash", async () => {
    const chat = await start({ email: "a@example.com" })
    expect(chat.messageCount).toBe(1)
    expect(chat.visitorName).toBe("Aoife")
    expect(chat.lastVisitorMessageAt).not.toBeNull()
    const found = await repo.byTokenHash(`hash-${n}`)
    expect(found?.id).toBe(chat.id)
    expect((await repo.byId(chat.id))?.visitorEmail).toBe("a@example.com")
    expect(await repo.byTokenHash("nope")).toBeNull()
    const first = await repo.messagesAfter(chat.id, 0)
    expect(first.map((m) => [m.sender, m.body])).toEqual([
      ["visitor", "Hello there"],
    ])
  })

  it("(b) messagesAfter returns only newer messages in order", async () => {
    const chat = await start()
    const m2 = await repo.addMessage({
      conversationId: chat.id,
      sender: "visitor",
      body: "two",
    })
    await repo.addMessage({
      conversationId: chat.id,
      sender: "staff",
      body: "three",
      senderName: "Magda",
    })
    await repo.addMessage({
      conversationId: chat.id,
      sender: "ai",
      body: "four",
    })
    const after = await repo.messagesAfter(chat.id, m2!.id)
    expect(after.map((m) => m.body)).toEqual(["three", "four"])
    expect(after[0]!.senderName).toBe("Magda")
    const refreshed = await repo.byId(chat.id)
    expect(refreshed?.messageCount).toBe(4)
    expect(refreshed?.aiReplyCount).toBe(1)
    expect(refreshed?.lastReplyAt).not.toBeNull()
  })

  it("(c) requireBotOwns blocks after setAi(false), assign and flagNeedsHuman", async () => {
    const user = await createUser("admin")
    const bot = (id: string) =>
      repo.addMessage({
        conversationId: id,
        sender: "ai",
        body: "hi",
        requireBotOwns: true,
      })

    const a = await start()
    expect(await bot(a.id)).not.toBeNull()
    await repo.setAi(a.id, false)
    expect(await bot(a.id)).toBeNull()

    const b = await start()
    await repo.assign(b.id, user.id)
    expect(await bot(b.id)).toBeNull()

    const c = await start()
    await repo.flagNeedsHuman(c.id)
    expect(await bot(c.id)).toBeNull()
  })

  it("(d) a notice kind is written once and leaves counters alone on conflict", async () => {
    const chat = await start()
    const notice = () =>
      repo.addMessage({
        conversationId: chat.id,
        sender: "system",
        body: "n",
        noticeKind: "handoff",
      })
    expect(await notice()).not.toBeNull()
    expect(await notice()).toBeNull()
    const rows = await getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.noticeKind, "handoff"))
    expect(rows).toHaveLength(1)
    expect((await repo.byId(chat.id))?.messageCount).toBe(2)
  })

  it("(e) the 301st message is refused", async () => {
    const chat = await start()
    await getDb()
      .update(chatConversations)
      .set({ messageCount: 299 })
      .where(eq(chatConversations.id, chat.id))
    expect(
      await repo.addMessage({
        conversationId: chat.id,
        sender: "visitor",
        body: "300",
      })
    ).not.toBeNull()
    expect(
      await repo.addMessage({
        conversationId: chat.id,
        sender: "visitor",
        body: "301",
      })
    ).toBeNull()
  })

  it("(f) leases are exclusive, releasable and expire", async () => {
    const chat = await start()
    const results = await Promise.all([
      repo.claimLease(chat.id),
      repo.claimLease(chat.id),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    await repo.releaseLease(chat.id)
    expect(await repo.claimLease(chat.id)).toBe(true)
    await getDb()
      .update(chatConversations)
      .set({ aiLeaseUntil: new Date(Date.now() - 1000) })
      .where(eq(chatConversations.id, chat.id))
    expect(await repo.claimLease(chat.id)).toBe(true)
  })

  it("(g) addMessage on a closed chat returns null", async () => {
    const chat = await start()
    const closed = await repo.close(chat.id)
    expect(closed?.status).toBe("closed")
    expect(
      await repo.addMessage({
        conversationId: chat.id,
        sender: "staff",
        body: "late",
      })
    ).toBeNull()
    expect(
      await repo.addMessage({
        conversationId: chat.id,
        sender: "system",
        body: "This chat has ended.",
        requireOpen: false,
      })
    ).not.toBeNull()
  })

  it("(h) markRead with an older message id leaves the chat unread", async () => {
    const chat = await start()
    const first = (await repo.messagesAfter(chat.id, 0))[0]!
    await repo.addMessage({
      conversationId: chat.id,
      sender: "visitor",
      body: "again",
    })
    expect(await repo.unreadCount()).toBe(1)
    await repo.markRead(chat.id, first.id)
    expect(await repo.unreadCount()).toBe(1)
    const list = await repo.listForStaff({ status: "open", limit: 10 })
    expect(list.items[0]!.unread).toBe(true)
    const last = (await repo.messagesAfter(chat.id, first.id))[0]!
    await repo.markRead(chat.id, last.id)
    expect(await repo.unreadCount()).toBe(0)
  })

  it("(i) flagNeedsHuman is true once, setAi(true) clears it", async () => {
    const chat = await start()
    expect(await repo.flagNeedsHuman(chat.id)).toBe(true)
    expect(await repo.flagNeedsHuman(chat.id)).toBe(false)
    const on = await repo.setAi(chat.id, true)
    expect(on?.needsHuman).toBe(false)
    await repo.close(chat.id)
    expect(await repo.setAi(chat.id, false)).toBeNull()
  })

  it("close only transitions: a second close returns null and keeps closed_at", async () => {
    const chat = await start()
    const first = await repo.close(chat.id)
    expect(first?.closedAt).not.toBeNull()
    expect(await repo.close(chat.id)).toBeNull()
    expect((await repo.byId(chat.id))?.closedAt).toEqual(first!.closedAt)
  })

  it("(j) staffOnline follows presence", async () => {
    const user = await createUser("admin")
    expect(await repo.staffOnline()).toBe(false)
    await repo.touchPresence(user.id)
    expect(await repo.staffOnline()).toBe(true)
    expect(await repo.staffOnline(-1000)).toBe(false)
  })

  it("lists with a cursor, sets email, recentForModel and remove", async () => {
    const a = await start()
    const b = await start()
    const c = await start()
    const p1 = await repo.listForStaff({ status: "open", limit: 2 })
    expect(p1.items.map((i) => i.id)).toEqual([c.id, b.id])
    expect(p1.next).not.toBeNull()
    const p2 = await repo.listForStaff({
      status: "open",
      limit: 2,
      cursor: p1.next!,
    })
    expect(p2.items.map((i) => i.id)).toEqual([a.id])
    expect(p2.next).toBeNull()

    expect(
      (await repo.setVisitorEmail(a.id, "x@example.com"))?.visitorEmail
    ).toBe("x@example.com")
    await repo.addMessage({
      conversationId: a.id,
      sender: "system",
      body: "sys",
    })
    await repo.addMessage({ conversationId: a.id, sender: "ai", body: "bot" })
    expect((await repo.recentForModel(a.id)).map((m) => m.sender)).toEqual([
      "visitor",
      "ai",
    ])
    await repo.close(a.id)
    expect(await repo.setVisitorEmail(a.id, "y@example.com")).toBeNull()
    expect(await repo.remove(a.id)).toBe(true)
    expect(await repo.remove(a.id)).toBe(false)
  })

  it("markRead on the first message clears unread right after creation", async () => {
    const chat = await start()
    const first = (await repo.messagesAfter(chat.id, 0))[0]!
    expect(await repo.unreadCount()).toBe(1)
    await repo.markRead(chat.id, first.id)
    expect(await repo.unreadCount()).toBe(0)
    const list = await repo.listForStaff({ status: "open", limit: 10 })
    expect(list.items[0]!.unread).toBe(false)
  })

  it("ignores a malformed cursor", async () => {
    const chat = await start()
    const page = await repo.listForStaff({
      status: "open",
      limit: 10,
      cursor: "2026-01-01T00:00:00.000Z|not-a-uuid",
    })
    expect(page.items.map((i) => i.id)).toEqual([chat.id])
  })

  it("claimNeedsHumanAlert is true once per chat", async () => {
    const chat = await start()
    expect(await repo.claimNeedsHumanAlert(chat.id)).toBe(true)
    expect(await repo.claimNeedsHumanAlert(chat.id)).toBe(false)
  })

  it("assigneeName returns the user's name, or null", async () => {
    const user = await createUser("admin", "agent@example.com")
    expect(await repo.assigneeName(user.id)).toBe(user.name)
    expect(
      await repo.assigneeName("00000000-0000-0000-0000-000000000000")
    ).toBeNull()
  })
})
