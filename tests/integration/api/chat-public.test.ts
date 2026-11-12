import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))

import { ChatGlobal } from "@/lib/content/globals"
import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { chatConversations, chatMessages, settings } from "@/server/db/schema"

import { ORIGIN } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { freshIp } from "../helpers/leads"

async function setChat(enabled: boolean, extra: Record<string, unknown> = {}) {
  const value = ChatGlobal.parse({ enabled, ...extra })
  await getDb()
    .insert(settings)
    .values({ key: "chat", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
}

beforeEach(async () => {
  await resetDb()
  await setChat(true)
})
afterAll(closeDb)

function chatRequest(
  path: string,
  init: {
    method?: string
    body?: unknown
    ip?: string
    cookie?: string
    origin?: string | null
  } = {}
) {
  const origin = init.origin === undefined ? ORIGIN : init.origin
  return app.request(`/api/v1/public/chat${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-real-ip": init.ip ?? freshIp(),
      "user-agent": "vitest",
      ...(origin ? { origin } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

const startBody = (o: Record<string, unknown> = {}) => ({
  name: "Aoife",
  message: "Hello there",
  consent: true,
  sourcePath: "/services",
  ...o,
})
const cookieOf = (res: Response) =>
  (res.headers.get("set-cookie") ?? "").split(";")[0]!

async function begin(ip = freshIp()) {
  const res = await chatRequest("/start", {
    method: "POST",
    body: startBody(),
    ip,
  })
  expect(res.status).toBe(201)
  return { res, cookie: cookieOf(res), view: await res.json() }
}

describe("chat public api", () => {
  it("/status is 404 when chat is disabled, and /start too", async () => {
    await setChat(false)
    expect((await chatRequest("/status")).status).toBe(404)
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody(),
    })
    expect(res.status).toBe(404)
  })

  it("/status returns the reduced settings with defaults", async () => {
    await setChat(true, { welcome: "", bot: { name: "" } })
    const res = await chatRequest("/status")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      enabled: true,
      online: false,
      botActive: false,
      welcome: "Hi, how can we help?",
      botName: "Assistant",
      turnstileSiteKey: null,
    })
    expect(body.offlineNote).toContain("No one is online")
  })

  it("start without consent is 400 and stores nothing", async () => {
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody({ consent: false }),
    })
    expect(res.status).toBe(400)
    expect(await getDb().select().from(chatConversations)).toHaveLength(0)
  })

  it("a filled honeypot answers { ok: true } and stores nothing", async () => {
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody({ website: "http://spam.example" }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    expect(await getDb().select().from(chatConversations)).toHaveLength(0)
  })

  it("the 6th start from one IP is 429 with Retry-After", async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++) {
      const r = await chatRequest("/start", {
        method: "POST",
        body: startBody(),
        ip,
      })
      expect(r.status).toBe(201)
    }
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody(),
      ip,
    })
    expect(res.status).toBe(429)
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0)
  })

  it("sets the mk_chat cookie with the specified flags and stores only a hash", async () => {
    const { res, view } = await begin()
    const header = res.headers.get("set-cookie")!
    expect(header).toMatch(/^mk_chat=[A-Za-z0-9_-]{40,}/)
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/SameSite=Lax/i)
    expect(header).toMatch(/Path=\/api\/v1\/public\/chat/)
    expect(header).toMatch(/Max-Age=2592000/)
    expect(view).toMatchObject({ status: "open", botActive: false })
    expect(view.messages).toHaveLength(1)
    const [row] = await getDb().select().from(chatConversations)
    expect(header).not.toContain(row!.tokenHash)
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("start with an existing open chat cookie returns it, no second chat", async () => {
    const { cookie, view } = await begin()
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody({ message: "Again" }),
      cookie,
    })
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe(view.id)
    expect(await getDb().select().from(chatConversations)).toHaveLength(1)
  })

  it("/conversation?after returns only newer messages", async () => {
    const { cookie, view } = await begin()
    const post = await chatRequest("/messages", {
      method: "POST",
      body: { body: "second" },
      cookie,
    })
    expect(post.status).toBe(201)
    const res = await chatRequest(`/conversation?after=${view.lastId}`, {
      cookie,
    })
    const body = await res.json()
    expect(body.messages.map((m: { body: string }) => m.body)).toEqual([
      "second",
    ])
    const all = await (await chatRequest("/conversation", { cookie })).json()
    expect(all.messages).toHaveLength(2)
  })

  it("each cookie sees only its own chat; unknown or missing cookies get 404", async () => {
    const first = await begin()
    const other = await begin()
    expect(other.view.id).not.toBe(first.view.id)
    const mine = await chatRequest("/conversation", { cookie: other.cookie })
    expect((await mine.json()).id).toBe(other.view.id)
    expect((await chatRequest("/conversation")).status).toBe(404)
    expect(
      (await chatRequest("/conversation", { cookie: "mk_chat=bogus" })).status
    ).toBe(404)
    const post = await chatRequest("/messages", {
      method: "POST",
      body: { body: "hi" },
      cookie: "mk_chat=bogus",
    })
    expect(post.status).toBe(404)
  })

  it("a cross-origin POST is 403", async () => {
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody(),
      origin: "https://evil.example",
    })
    expect(res.status).toBe(403)
    expect(await getDb().select().from(chatConversations)).toHaveLength(0)
  })

  it("messages on a closed chat is 409", async () => {
    const { cookie } = await begin()
    expect((await chatRequest("/end", { method: "POST", cookie })).status).toBe(
      200
    )
    const res = await chatRequest("/messages", {
      method: "POST",
      body: { body: "hello?" },
      cookie,
    })
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toBe("This chat has ended")
    const msgs = await getDb().select().from(chatMessages)
    expect(msgs.map((m) => m.body)).toContain("This chat has ended.")
  })

  it("a body of 2001 chars is 400", async () => {
    const { cookie } = await begin()
    const res = await chatRequest("/messages", {
      method: "POST",
      body: { body: "x".repeat(2001) },
      cookie,
    })
    expect(res.status).toBe(400)
    const start = await chatRequest("/start", {
      method: "POST",
      body: startBody({ message: "x".repeat(2001) }),
    })
    expect(start.status).toBe(400)
  })

  it("/email stores the address on an open chat only", async () => {
    const { cookie } = await begin()
    const res = await chatRequest("/email", {
      method: "POST",
      body: { email: "aoife@example.com" },
      cookie,
    })
    expect(res.status).toBe(200)
    const [row] = await getDb().select().from(chatConversations)
    expect(row!.visitorEmail).toBe("aoife@example.com")
    await chatRequest("/end", { method: "POST", cookie })
    const closed = await chatRequest("/email", {
      method: "POST",
      body: { email: "b@example.com" },
      cookie,
    })
    expect(closed.status).toBe(409)
  })

  it("a message past the 300 cap is 429", async () => {
    const { cookie, view } = await begin()
    await getDb()
      .update(chatConversations)
      .set({ messageCount: 300 })
      .where(eq(chatConversations.id, view.id))
    const res = await chatRequest("/messages", {
      method: "POST",
      body: { body: "one more" },
      cookie,
    })
    expect(res.status).toBe(429)
  })
})
