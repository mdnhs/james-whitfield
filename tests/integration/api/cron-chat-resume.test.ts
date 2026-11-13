import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  maybeReply: vi.fn(async () => "skipped"),
  active: true,
  tasks: [] as Promise<unknown>[],
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    mocks.tasks.push(Promise.resolve().then(task))
  },
}))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))
vi.mock("@/server/modules/chat/bot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/modules/chat/bot")>()),
  maybeReply: mocks.maybeReply,
  isActive: async () => mocks.active,
}))

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import * as repo from "@/server/modules/chat/repo"

import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  mocks.maybeReply.mockClear()
  mocks.active = true
  mocks.tasks.length = 0
})
afterAll(closeDb)

const tick = () =>
  app.request("/api/v1/cron/tick", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

async function stalledChat() {
  const chat = await repo.createConversation({
    tokenHash: `hash-${Math.random()}`,
    name: "Aoife",
    email: null,
    sourcePath: "/",
    firstMessage: "Hello",
  })
  await getDb().execute(sql`
    update chat_conversations set
      last_visitor_message_at = now() - interval '10 minutes',
      last_message_at = now() - interval '10 minutes'
    where id = ${chat.id}`)
  return chat
}

describe("cron chat recovery", () => {
  it("defers a stalled chat's reply while the assistant is active", async () => {
    const chat = await stalledChat()
    expect((await tick()).status).toBe(200)
    await Promise.all(mocks.tasks)
    expect(mocks.maybeReply).toHaveBeenCalledWith(chat.id)
  })

  it("defers nothing while the assistant is off", async () => {
    mocks.active = false
    await stalledChat()
    expect((await tick()).status).toBe(200)
    await Promise.all(mocks.tasks)
    expect(mocks.maybeReply).not.toHaveBeenCalled()
  })
})
