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
  isActive: async () => false,
}))

import { ChatGlobal, NotificationsGlobal } from "@/lib/content/globals"
import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import {
  apiRateLimits,
  chatConversations,
  chatMessages,
  settings,
} from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import * as bot from "@/server/modules/chat/bot"
import * as repo from "@/server/modules/chat/repo"

import { ORIGIN } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { freshIp } from "../helpers/leads"

async function put(key: string, value: unknown) {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
}

beforeEach(async () => {
  await resetDb()
  clearOutbox()
  mocks.maybeReply.mockClear()
  mocks.tasks.length = 0
  await put("chat", ChatGlobal.parse({ enabled: true }))
  await put(
    "notifications",
    NotificationsGlobal.parse({ recipients: ["team@example.com"] })
  )
})
afterAll(closeDb)

function chatRequest(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {}
) {
  return app.request(`/api/v1/public/chat${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-real-ip": freshIp(),
      origin: ORIGIN,
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

async function begin(message = "Hello there") {
  const res = await chatRequest("/start", {
    method: "POST",
    body: { name: "Aoife", message, consent: true, sourcePath: "/" },
  })
  expect(res.status).toBe(201)
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]!
  return { cookie, id: (await res.json()).id as string }
}

const subjects = () => readOutbox().map((m) => m.subject)

describe("crisis email", () => {
  it("is sent after an earlier hand-off alert, exactly once", async () => {
    const { cookie, id } = await begin()
    await bot.handOff(id, "handoff")
    expect(subjects()).toEqual(["A visitor on the chat needs a person"])
    for (const body of ["I want to end my life", "suicidal again"]) {
      const res = await chatRequest("/messages", {
        method: "POST",
        body: { body },
        cookie,
      })
      expect(res.status).toBe(201)
    }
    expect(subjects()).toEqual([
      "A visitor on the chat needs a person",
      "A chat visitor may be in distress",
    ])
    expect(readOutbox()[1]!.text).toContain("may be in distress")
  })

  it("is sent for a first-message crisis, once", async () => {
    await begin("I want to die")
    expect(subjects()).toEqual(["A chat visitor may be in distress"])
  })
})

describe("lease release", () => {
  it("a stale release does not clear a newer lease", async () => {
    const { id } = await begin()
    const first = await repo.claimLease(id, 60_000)
    expect(first).toBeTruthy()
    expect(await repo.claimLease(id, 60_000)).toBeNull()
    // The first holder's lease expires; a second run claims its own.
    await getDb()
      .update(chatConversations)
      .set({ aiLeaseUntil: new Date(Date.now() - 1000) })
      .where(eq(chatConversations.id, id))
    const second = await repo.claimLease(id, 60_000)
    expect(second).toBeTruthy()
    expect(second).not.toBe(first)
    await repo.releaseLease(id, first!)
    expect((await repo.byId(id))!.aiLeaseUntil).not.toBeNull()
    await repo.releaseLease(id, second!)
    expect((await repo.byId(id))!.aiLeaseUntil).toBeNull()
  })
})

describe("public polling", () => {
  it("GET /conversation without a cookie is 404 and writes no rate-limit row", async () => {
    const res = await chatRequest("/conversation")
    expect(res.status).toBe(404)
    expect(await getDb().select().from(apiRateLimits)).toHaveLength(0)
  })
})

describe("start with an open chat", () => {
  it("appends the typed message and returns the view", async () => {
    const { cookie, id } = await begin()
    const res = await chatRequest("/start", {
      method: "POST",
      body: { name: "Aoife", message: "A second note", consent: true },
      cookie,
    })
    expect(res.status).toBe(201)
    const view = await res.json()
    expect(view.id).toBe(id)
    expect(view.messages.map((m: { body: string }) => m.body)).toContain(
      "A second note"
    )
    const rows = await getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, id))
    expect(rows.filter((m) => m.sender === "visitor")).toHaveLength(2)
  })

  it("runs the crisis check on the appended message", async () => {
    const { cookie, id } = await begin()
    await chatRequest("/start", {
      method: "POST",
      body: { name: "Aoife", message: "I want to end my life", consent: true },
      cookie,
    })
    expect((await repo.byId(id))!.needsHuman).toBe(true)
    expect(subjects()).toEqual(["A chat visitor may be in distress"])
  })
})
