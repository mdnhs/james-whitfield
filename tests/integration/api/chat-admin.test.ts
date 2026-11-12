import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  maybeReply: vi.fn(async () => "skipped"),
  tasks: [] as Promise<unknown>[],
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    mocks.tasks.push(Promise.resolve().then(task))
  },
}))
vi.mock("@/server/modules/chat/bot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/modules/chat/bot")>()),
  maybeReply: mocks.maybeReply,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import {
  auditLogs,
  chatMessages,
  chatPresence,
  users,
} from "@/server/db/schema"
import * as repo from "@/server/modules/chat/repo"

import {
  adminRequest,
  cookieFor,
  createUser,
  signInWithTwoFactor,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  mocks.maybeReply.mockClear()
  mocks.tasks.length = 0
})
afterAll(closeDb)

async function newChat(name = "Aoife") {
  return repo.createConversation({
    tokenHash: `hash-${Math.random()}`,
    name,
    email: null,
    sourcePath: "/",
    firstMessage: "Hello there",
  })
}

async function messages(id: string) {
  return getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(chatMessages.id)
}

async function row(id: string) {
  return (await repo.byId(id))!
}

// [list, unread, detail, reply, takeover, handback, assign, read, close, delete]
const MATRIX: Record<RoleName, number[]> = {
  owner: [200, 200, 200, 201, 200, 200, 200, 200, 200, 200],
  admin: [200, 200, 200, 201, 200, 200, 200, 200, 200, 200],
  intake: [200, 200, 200, 201, 200, 200, 403, 200, 200, 403],
  editor: Array(10).fill(403),
  author: Array(10).fill(403),
  marketer: Array(10).fill(403),
  viewer: Array(10).fill(403),
}

describe.each(ROLE_NAMES)("chat admin RBAC for %s", (role) => {
  it("matches the matrix", async () => {
    const cookie = await cookieFor(role)
    const status = async (
      path: string,
      method = "GET",
      body?: unknown,
      id?: string
    ) =>
      (
        await adminRequest(`/chat${id ? `/${id}` : ""}${path}`, cookie, {
          method,
          body,
        })
      ).status
    const mk = async () => (await newChat()).id
    const got = [
      await status(""),
      await status("/unread"),
      await status("", "GET", undefined, await mk()),
      await status("/messages", "POST", { body: "hi" }, await mk()),
      await status("/takeover", "POST", undefined, await mk()),
      await status("/handback", "POST", undefined, await mk()),
      await status("/assign", "POST", { userId: null }, await mk()),
      await status("/read", "POST", { upTo: 1 }, await mk()),
      await status("/close", "POST", undefined, await mk()),
      await status("", "DELETE", undefined, await mk()),
    ]
    expect(got).toEqual(MATRIX[role])
  })
})

describe("chat admin API", () => {
  it("lists, shows detail with messages after a cursor, and counts unread", async () => {
    const cookie = await cookieFor("intake")
    const chat = await newChat()
    const list = await (await adminRequest("/chat", cookie)).json()
    expect(list.items).toHaveLength(1)
    expect(JSON.stringify(list)).not.toContain("tokenHash")
    expect(
      (await (await adminRequest("/chat/unread", cookie)).json()).count
    ).toBe(1)
    const detail = await (await adminRequest(`/chat/${chat.id}`, cookie)).json()
    expect(detail.messages).toHaveLength(1)
    expect(JSON.stringify(detail)).not.toContain("tokenHash")
    const after = await (
      await adminRequest(
        `/chat/${chat.id}?after=${detail.messages[0].id}`,
        cookie
      )
    ).json()
    expect(after.messages).toHaveLength(0)
  })

  it("rejects bad cursor params", async () => {
    const cookie = await cookieFor("intake")
    const chat = await newChat()
    expect(
      (await adminRequest(`/chat?cursor=${"x".repeat(101)}`, cookie)).status
    ).toBe(400)
    expect(
      (await adminRequest(`/chat/${chat.id}?after=-1`, cookie)).status
    ).toBe(400)
    expect(
      (
        await adminRequest(`/chat/${chat.id}/read`, cookie, {
          method: "POST",
          body: { upTo: -2 },
        })
      ).status
    ).toBe(400)
  })

  it("touches presence for staff who can reply", async () => {
    const cookie = await cookieFor("intake")
    await adminRequest("/chat", cookie)
    expect(await getDb().select().from(chatPresence)).toHaveLength(1)
  })

  it("a staff reply disables the AI, assigns the actor and adds the join notice once", async () => {
    const cookie = await cookieFor("intake")
    const chat = await newChat()
    const reply = (body: string) =>
      adminRequest(`/chat/${chat.id}/messages`, cookie, {
        method: "POST",
        body: { body },
      })
    expect((await reply("Hi Aoife")).status).toBe(201)
    expect((await reply("Anything else?")).status).toBe(201)
    const after = await row(chat.id)
    const [actor] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, "intake@example.com"))
    expect(after.aiEnabled).toBe(false)
    expect(after.assignedTo).toBe(actor!.id)
    const all = await messages(chat.id)
    expect(
      all.filter((m) => m.body === "intake joined the chat.")
    ).toHaveLength(1)
    expect(all.filter((m) => m.sender === "staff")).toHaveLength(2)
    const logs = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "chat.reply"))
    expect(logs).toHaveLength(2)
    expect(JSON.stringify(logs)).not.toContain("Hi Aoife")
  })

  it("takeover assigns without a message", async () => {
    const cookie = await cookieFor("intake")
    const chat = await newChat()
    expect(
      (
        await adminRequest(`/chat/${chat.id}/takeover`, cookie, {
          method: "POST",
        })
      ).status
    ).toBe(200)
    const after = await row(chat.id)
    expect(after.aiEnabled).toBe(false)
    expect(after.assignedTo).not.toBeNull()
    expect(
      (await messages(chat.id)).filter((m) => m.sender === "staff")
    ).toHaveLength(0)
  })

  it("a reply to a closed chat is 409", async () => {
    const cookie = await cookieFor("intake")
    const chat = await newChat()
    await repo.close(chat.id)
    const res = await adminRequest(`/chat/${chat.id}/messages`, cookie, {
      method: "POST",
      body: { body: "hi" },
    })
    expect(res.status).toBe(409)
  })

  it("handback by a different user is 409; by the holder clears needs_human and defers the bot", async () => {
    const holder = await cookieFor("intake", "holder@example.com")
    const other = await cookieFor("intake", "other@example.com")
    const chat = await newChat()
    await adminRequest(`/chat/${chat.id}/takeover`, holder, { method: "POST" })
    await repo.flagNeedsHuman(chat.id)
    expect(
      (
        await adminRequest(`/chat/${chat.id}/handback`, other, {
          method: "POST",
        })
      ).status
    ).toBe(409)
    expect(
      (
        await adminRequest(`/chat/${chat.id}/handback`, holder, {
          method: "POST",
        })
      ).status
    ).toBe(200)
    await Promise.all(mocks.tasks)
    const after = await row(chat.id)
    expect(after.needsHuman).toBe(false)
    expect(after.aiEnabled).toBe(true)
    expect(after.assignedTo).toBeNull()
    expect(
      (await messages(chat.id)).some(
        (m) => m.body === "The assistant is back on this chat."
      )
    ).toBe(true)
    expect(mocks.maybeReply).toHaveBeenCalledWith(chat.id)
  })

  it("assign (admin) sets and clears the assignee", async () => {
    const admin = await cookieFor("admin")
    const intake = await createUser("intake", "i2@example.com")
    const chat = await newChat()
    const res = await adminRequest(`/chat/${chat.id}/assign`, admin, {
      method: "POST",
      body: { userId: intake.id },
    })
    expect(res.status).toBe(200)
    expect((await row(chat.id)).assignedTo).toBe(intake.id)
    await adminRequest(`/chat/${chat.id}/assign`, admin, {
      method: "POST",
      body: { userId: null },
    })
    expect((await row(chat.id)).assignedTo).toBeNull()
    const missing = await adminRequest(`/chat/${chat.id}/assign`, admin, {
      method: "POST",
      body: { userId: "00000000-0000-4000-8000-000000000000" },
    })
    expect(missing.status).toBe(404)
  })

  it("read with an older upTo keeps the chat unread; the newest clears it", async () => {
    const cookie = await cookieFor("intake")
    const chat = await newChat()
    await new Promise((r) => setTimeout(r, 20))
    const second = (await repo.addMessage({
      conversationId: chat.id,
      sender: "visitor",
      body: "Second",
    }))!
    const [first] = await messages(chat.id)
    const unread = async () =>
      (await (await adminRequest("/chat/unread", cookie)).json()).count
    await adminRequest(`/chat/${chat.id}/read`, cookie, {
      method: "POST",
      body: { upTo: first!.id },
    })
    expect(await unread()).toBe(1)
    await adminRequest(`/chat/${chat.id}/read`, cookie, {
      method: "POST",
      body: { upTo: second.id },
    })
    expect(await unread()).toBe(0)
  })

  it("close adds the ended notice once", async () => {
    const cookie = await cookieFor("intake")
    const chat = await newChat()
    await adminRequest(`/chat/${chat.id}/close`, cookie, { method: "POST" })
    await adminRequest(`/chat/${chat.id}/close`, cookie, { method: "POST" })
    expect(
      (await messages(chat.id)).filter((m) => m.body === "This chat has ended.")
    ).toHaveLength(1)
    expect((await row(chat.id)).status).toBe("closed")
  })

  it("delete (admin) removes the chat and audits chat.delete; unknown id is 404", async () => {
    const admin = await cookieFor("admin")
    const chat = await newChat()
    expect(
      (await adminRequest(`/chat/${chat.id}`, admin, { method: "DELETE" }))
        .status
    ).toBe(200)
    expect(await repo.byId(chat.id)).toBeNull()
    expect(
      await getDb()
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "chat.delete"))
    ).toHaveLength(1)
    expect(
      (await adminRequest(`/chat/${chat.id}`, admin, { method: "DELETE" }))
        .status
    ).toBe(404)
  })

  it("view-as can read but every mutation is 403", async () => {
    await createUser("owner", "o@example.com")
    const target = await createUser("intake", "t@example.com")
    const cookie = await viewAs(
      await signInWithTwoFactor("o@example.com"),
      target.id
    )
    const chat = await newChat()
    expect((await adminRequest("/chat", cookie)).status).toBe(200)
    for (const [path, method, body] of [
      [`/${chat.id}/messages`, "POST", { body: "hi" }],
      [`/${chat.id}/takeover`, "POST", undefined],
      [`/${chat.id}/handback`, "POST", undefined],
      [`/${chat.id}/read`, "POST", { upTo: 1 }],
      [`/${chat.id}/close`, "POST", undefined],
    ] as const) {
      expect(
        (await adminRequest(`/chat${path}`, cookie, { method, body })).status
      ).toBe(403)
    }
    expect((await row(chat.id)).status).toBe("open")
  })
})
