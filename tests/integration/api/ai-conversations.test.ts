// tests/integration/api/ai-conversations.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { eq } from "drizzle-orm"

import { closeDb, getDb } from "@/server/db/client"
import {
  aiConversations,
  aiMessages,
  auditLogs,
  users,
} from "@/server/db/schema"
import {
  appendMessage,
  createConversation,
} from "@/server/modules/ai/conversations"
import { runTick } from "@/server/modules/scheduler/service"

import {
  adminRequest,
  cookieFor,
  createUser,
  signIn,
  viewAs,
} from "../helpers/auth"
import { seedAi } from "../helpers/ai"
import { resetDb } from "../helpers/db"

const DAY = 86_400_000
async function convFor(email: string, title = "Hello") {
  const [u] = await getDb().select().from(users).where(eq(users.email, email))
  const c = await createConversation(u!.id, title, "gemini-flash-latest")
  await appendMessage(c.id, {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text: title }],
  })
  return { userId: u!.id, id: c.id }
}

beforeEach(async () => {
  await resetDb()
  await seedAi()
})
afterAll(closeDb)

describe("conversation history", () => {
  it("lists, opens and deletes only your own", async () => {
    const editor = await cookieFor("editor")
    const viewer = await cookieFor("viewer")
    const mine = await convFor("editor@example.com", "Mine")
    const theirs = await convFor("viewer@example.com", "Theirs")
    const list = await (await adminRequest("/ai/conversations", editor)).json()
    expect(list.items.map((c: { title: string }) => c.title)).toEqual(["Mine"])
    const open = await (
      await adminRequest(`/ai/conversations/${mine.id}`, editor)
    ).json()
    expect(open.messages[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "Mine" }],
    })
    expect(
      (await adminRequest(`/ai/conversations/${theirs.id}`, editor)).status
    ).toBe(404)
    expect(
      (
        await adminRequest(`/ai/conversations/${theirs.id}`, editor, {
          method: "DELETE",
        })
      ).status
    ).toBe(404)
    expect(
      (
        await adminRequest(`/ai/conversations/${mine.id}`, editor, {
          method: "DELETE",
        })
      ).status
    ).toBe(200)
    expect(
      await getDb()
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, mine.id))
    ).toHaveLength(0)
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "ai.conversation_delete"))
    expect(log!.summary).not.toContain("Mine")
    void viewer
  })

  it("shows the viewed person's history read-only during View-as (Ruling R12)", async () => {
    await createUser("owner", "o@example.com")
    const target = await createUser("editor", "t@example.com")
    const c = await convFor("t@example.com", "Target's")
    const viewing = await viewAs(await signIn("o@example.com"), target.id)
    const list = await (await adminRequest("/ai/conversations", viewing)).json()
    expect(list.items).toHaveLength(1)
    const del = await adminRequest(`/ai/conversations/${c.id}`, viewing, {
      method: "DELETE",
    })
    expect(del.status).toBe(403)
  })
})

describe("retention and GDPR", () => {
  it("the cron tick purges conversations not updated for 90 days", async () => {
    await cookieFor("editor")
    const old = await convFor("editor@example.com", "Old")
    const fresh = await convFor("editor@example.com", "Fresh")
    await getDb()
      .update(aiConversations)
      .set({ updatedAt: new Date(Date.now() - 91 * DAY) })
      .where(eq(aiConversations.id, old.id))
    const result = await runTick()
    expect(result.purged.aiConversations).toBe(1)
    const left = await getDb().select().from(aiConversations)
    expect(left.map((c) => c.id)).toEqual([fresh.id])
  })

  it("deleting the user deletes their conversations", async () => {
    await cookieFor("editor")
    const c = await convFor("editor@example.com")
    await getDb().delete(users).where(eq(users.id, c.userId))
    expect(await getDb().select().from(aiConversations)).toHaveLength(0)
    expect(await getDb().select().from(aiMessages)).toHaveLength(0)
  })

  it("a DSAR export includes the person's own conversations", async () => {
    await cookieFor("editor")
    await convFor("editor@example.com", "Draft my bio")
    const res = await adminRequest(
      "/leads/dsar?email=Editor%40Example.com",
      await cookieFor("owner")
    )
    const data = await res.json()
    expect(data.aiConversations).toHaveLength(1)
    expect(data.aiConversations[0]).toMatchObject({
      title: "Draft my bio",
      messages: [
        expect.objectContaining({ role: "user", text: "Draft my bio" }),
      ],
    })
  })
})
