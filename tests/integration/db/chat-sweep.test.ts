import { eq, sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { chatConversations, chatMessages } from "@/server/db/schema"
import * as repo from "@/server/modules/chat/repo"
import { chatSweep } from "@/server/modules/chat/sweep"
import { purgeExpired } from "@/server/modules/leads/retention"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

let n = 0
async function start() {
  n += 1
  return repo.createConversation({
    tokenHash: `sweep-${n}`,
    name: "Aoife",
    email: null,
    sourcePath: "/services",
    firstMessage: "Hello there",
  })
}

// Move the chat's clocks back by `minutes` (all in DB time).
async function age(id: string, minutes: number) {
  await getDb().execute(sql`
    update chat_conversations set
      last_message_at = now() - ${minutes} * interval '1 minute',
      last_visitor_message_at = now() - ${minutes} * interval '1 minute',
      created_at = now() - ${minutes} * interval '1 minute'
    where id = ${id}`)
}

const sweep = () => getDb().transaction((tx) => chatSweep(tx, new Date()))

describe("chat sweep", () => {
  it("alerts a waiting visitor once, and again after a new message", async () => {
    const chat = await start()
    await getDb()
      .update(chatConversations)
      .set({ needsHuman: true })
      .where(eq(chatConversations.id, chat.id))
    await age(chat.id, 6)
    expect((await sweep()).alerted).toHaveLength(1)
    expect((await sweep()).alerted).toHaveLength(0)

    await repo.addMessage({
      conversationId: chat.id,
      sender: "visitor",
      body: "hi?",
    })
    expect((await sweep()).alerted).toHaveLength(0)
    await age(chat.id, 6)
    await getDb().execute(sql`
      update chat_conversations set no_reply_alerted_at = now() - interval '10 minutes'
      where id = ${chat.id}`)
    expect((await sweep()).alerted).toHaveLength(1)
    expect((await sweep()).alerted).toHaveLength(0)
  })

  it("does not alert a bot-owned chat with a live lease, and resumes a stalled one", async () => {
    const chat = await start()
    await age(chat.id, 3)
    await getDb().execute(sql`
      update chat_conversations set ai_lease_until = now() + interval '1 minute'
      where id = ${chat.id}`)
    let r = await sweep()
    expect(r.resumed).toEqual([])
    await getDb().execute(sql`
      update chat_conversations set ai_lease_until = now() - interval '1 second'
      where id = ${chat.id}`)
    r = await sweep()
    expect(r.resumed).toEqual([chat.id])
    expect(r.alerted).toHaveLength(0)
  })

  it("auto-closes a 25 hour idle chat with one notice", async () => {
    const chat = await start()
    await age(chat.id, 25 * 60)
    const r = await sweep()
    expect(r.autoClosed).toBe(1)
    expect(r.resumed).toEqual([])
    const row = await repo.byId(chat.id)
    expect(row?.status).toBe("closed")
    const msgs = await repo.messagesAfter(chat.id, 0)
    expect(msgs.filter((m) => m.body === "This chat has ended.")).toHaveLength(
      1
    )
    expect((await sweep()).autoClosed).toBe(0)
  })

  it("purges chats past the retention window and keeps younger ones", async () => {
    const old = await start()
    const young = await start()
    await getDb().execute(sql`
      update chat_conversations set last_message_at = now() - interval '13 months'
      where id = ${old.id}`)
    await getDb().execute(sql`
      update chat_conversations set last_message_at = now() - interval '11 months'
      where id = ${young.id}`)
    const out = await getDb().transaction((tx) => purgeExpired(tx, new Date()))
    expect(out.chats).toBe(1)
    expect(await repo.byId(old.id)).toBeNull()
    expect(await repo.byId(young.id)).not.toBeNull()
    expect(
      await getDb()
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, old.id))
    ).toHaveLength(0)
  })
})
