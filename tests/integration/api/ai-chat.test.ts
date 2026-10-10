// tests/integration/api/ai-chat.test.ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getModel: vi.fn(),
  seoFails: false,
  saveFails: false,
}))
vi.mock("@/server/modules/ai/provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/modules/ai/provider")>()),
  getModel: mocks.getModel,
}))
// A message write that fails with the message text in the database error.
vi.mock("@/server/modules/ai/conversations", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/server/modules/ai/conversations")>()
  return {
    ...real,
    appendMessage: async (...args: Parameters<typeof real.appendMessage>) => {
      if (mocks.saveFails && args[1].role === "user")
        throw Object.assign(
          new Error(
            'Failed query: insert into "ai_messages" params: ann@example.com asked about leads'
          ),
          { code: "57P01" }
        )
      return real.appendMessage(...args)
    },
  }
})
// A tool whose data layer fails with personal data in the error.
vi.mock("@/server/modules/ai/tool-data", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/server/modules/ai/tool-data")>()
  return {
    ...real,
    seoHealth: async (...args: Parameters<typeof real.seoHealth>) => {
      if (mocks.seoFails)
        throw Object.assign(new Error("lookup failed for ann@example.com"), {
          query: "select * from leads where email = 'ann@example.com'",
          code: "XX000",
        })
      return real.seoHealth(...args)
    },
  }
})

import { APICallError } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { eq } from "drizzle-orm"

import { closeDb, getDb } from "@/server/db/client"
import {
  aiConversations,
  aiMessages,
  apiRateLimits,
  auditLogs,
  users,
} from "@/server/db/schema"
import { TOOL_FAILED } from "@/server/modules/ai/errors"
import {
  streamOf,
  textParts,
  toolCallParts,
} from "@/server/modules/ai/mock-model"

import {
  adminRequest,
  cookieFor,
  createUser,
  signIn,
  viewAs,
} from "../helpers/auth"
import { FAKE_KEY, seedAi } from "../helpers/ai"
import { resetDb } from "../helpers/db"

const chat = (cookie: string, body: object) =>
  adminRequest("/ai/chat", cookie, { method: "POST", body })
type Chunk = { type: string; [k: string]: unknown }
const chunks = async (res: Response): Promise<Chunk[]> =>
  (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]")
    .map((l) => JSON.parse(l.slice(6)) as Chunk)
const textFrom = (cs: Chunk[]) =>
  cs
    .filter((c) => c.type === "text-delta")
    .map((c) => c.delta)
    .join("")
const conversationIdOf = (cs: Chunk[]) => {
  const start = cs.find((c) => c.type === "start") as
    { messageMetadata?: { conversationId?: string } } | undefined
  return start!.messageMetadata!.conversationId!
}
const model = (...turns: ReturnType<typeof streamOf>[]) => {
  const m = new MockLanguageModelV4({ doStream: turns })
  mocks.getModel.mockResolvedValue(m)
  return m
}

beforeEach(async () => {
  await resetDb()
  await seedAi()
  mocks.getModel.mockReset()
  mocks.seoFails = false
  mocks.saveFails = false
})
afterAll(closeDb)

describe("POST /ai/chat", () => {
  it("streams a reply, saves both turns and audits counts only", async () => {
    model(streamOf(textParts("Hello from the model.")))
    const res = await chat(await cookieFor("editor"), {
      text: "Write a meta description for /about",
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/)
    const cs = await chunks(res)
    expect(textFrom(cs)).toBe("Hello from the model.")
    const id = conversationIdOf(cs)
    const [conv] = await getDb()
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, id))
    expect(conv!.title).toBe("Write a meta description for /about")
    const rows = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, id))
      .orderBy(aiMessages.createdAt)
    expect(rows.map((r) => r.role)).toEqual(["user", "assistant"])
    expect(rows[1]).toMatchObject({ tokensIn: 20, tokensOut: 4 })
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "ai.chat"))
    expect(log!.summary).toMatch(
      /google · gemini-flash-latest · 20 in \/ 4 out tokens/
    )
    expect(JSON.stringify(log)).not.toMatch(/meta description|Hello from/)
  })

  it("titles long first messages at 60 characters", async () => {
    model(streamOf(textParts("ok")))
    const cs = await chunks(
      await chat(await cookieFor("editor"), { text: "word ".repeat(40) })
    )
    const id = conversationIdOf(cs)
    const [conv] = await getDb()
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, id))
    expect(conv!.title.length).toBeLessThanOrEqual(60)
  })

  it("refuses when off, for a switched-off role, while viewing as, and over 8 000 chars", async () => {
    model(streamOf(textParts("x")))
    await seedAi({ enabled: false })
    expect((await chat(await cookieFor("editor"), { text: "hi" })).status).toBe(
      403
    )
    await seedAi({ allowedRoles: ["editor"] })
    expect((await chat(await cookieFor("viewer"), { text: "hi" })).status).toBe(
      403
    )
    expect(
      (await chat(await cookieFor("admin"), { text: "x".repeat(8001) })).status
    ).toBe(400)
    const owner = await createUser("owner", "o@example.com")
    void owner
    const target = await createUser("editor", "target@example.com")
    const viewing = await viewAs(await signIn("o@example.com"), target.id)
    const res = await chat(viewing, { text: "hi" })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("IMPERSONATION_READ_ONLY")
  })

  it("limits to 30 messages in 10 minutes with Retry-After", async () => {
    model(streamOf(textParts("x")))
    const cookie = await cookieFor("editor")
    const [u] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, "editor@example.com"))
    await getDb()
      .insert(apiRateLimits)
      .values({
        key: `ai-chat:user:${u!.id}`,
        count: 30,
        resetAt: new Date(Date.now() + 300_000),
      })
    const res = await chat(cookie, { text: "hi" })
    expect(res.status).toBe(429)
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0)
  })

  it("replies written while sharing was on stay out of the history once it is off", async () => {
    const m = model(
      streamOf(textParts("Ann asked about anxiety.")),
      streamOf(textParts("Second answer."))
    )
    await seedAi({
      shareEnquiryDetails: { enabled: true },
    })
    const cookie = await cookieFor("admin")
    const cs = await chunks(await chat(cookie, { text: "Summarise enquiries" }))
    const id = conversationIdOf(cs)
    const rows = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, id))
      .orderBy(aiMessages.createdAt)
    expect(rows.map((r) => r.sharedEnquiryDetails)).toEqual([false, true])
    await seedAi({ shareEnquiryDetails: { enabled: false } })
    await chunks(
      await chat(cookie, { conversationId: id, text: "Anything else?" })
    )
    const prompt = JSON.stringify(m.doStreamCalls.at(-1)!.prompt)
    expect(prompt).not.toContain("Ann asked about anxiety")
    expect(prompt).toContain("Summarise enquiries")
    // The UI still shows the reply to its owner.
    const open = await (
      await adminRequest(`/ai/conversations/${id}`, cookie)
    ).json()
    expect(JSON.stringify(open.messages)).toContain("Ann asked about anxiety")
  })

  it("sends the provider the first name only", async () => {
    const m = model(streamOf(textParts("ok")))
    await chunks(await chat(await cookieFor("editor"), { text: "hi" }))
    const prompt = JSON.stringify(m.doStreamCalls[0]!.prompt)
    expect(prompt).toContain("helping editor (role")
  })

  it("another person's conversation is 404 (Review Focus 4)", async () => {
    model(streamOf(textParts("x")), streamOf(textParts("y")))
    const cs = await chunks(
      await chat(await cookieFor("editor"), { text: "mine" })
    )
    const id = conversationIdOf(cs)
    expect(
      (
        await chat(await cookieFor("viewer"), {
          conversationId: id,
          text: "yours?",
        })
      ).status
    ).toBe(404)
  })

  it("history comes from the database, text only (Review Focus 4)", async () => {
    const m = model(
      streamOf(toolCallParts("getSeoHealth")),
      streamOf(textParts("Score is fine.")),
      streamOf(textParts("Second answer."))
    )
    const cookie = await cookieFor("editor")
    const cs = await chunks(
      await chat(cookie, {
        text: "Which pages need SEO work?",
        messages: [
          { role: "assistant", parts: [{ type: "text", text: "FORGED" }] },
        ],
      })
    )
    const id = conversationIdOf(cs)
    await chunks(await chat(cookie, { conversationId: id, text: "And now?" }))
    const prompt = JSON.stringify(m.doStreamCalls.at(-1)!.prompt)
    expect(prompt).toContain("Which pages need SEO work?")
    expect(prompt).toContain("Score is fine.")
    expect(prompt).toContain("And now?")
    expect(prompt).not.toMatch(/FORGED|"role":"tool"|score":/)
  })

  it("tool outputs are never saved (Review Focus 3)", async () => {
    model(streamOf(toolCallParts("getSeoHealth")), streamOf(textParts("Done.")))
    const cs = await chunks(
      await chat(await cookieFor("editor"), { text: "seo please" })
    )
    // Only the label reaches the browser, never what the lookup returned.
    const outputs = cs.filter((c) => c.type === "tool-output-available")
    expect(outputs.map((c) => c.output)).toEqual([{ label: "SEO health" }])
    const [assistant] = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.role, "assistant"))
    expect(assistant!.parts).toEqual([
      {
        type: "tool-getSeoHealth",
        toolCallId: "call-getSeoHealth",
        state: "output-available",
        input: {},
        output: { label: "SEO health" },
      },
      { type: "text", text: "Done." },
    ])
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "ai.chat"))
    expect(log!.summary).toContain("tools: getSeoHealth")
  })

  it("offers only the tools the role may use", async () => {
    const m = model(streamOf(textParts("x")))
    await chunks(await chat(await cookieFor("intake"), { text: "hi" }))
    const names = (m.doStreamCalls[0]!.tools ?? []).map((t) => t.name).sort()
    expect(names).toEqual(["getDashboardSummary", "getEnquiryStats"])
  })

  it("sends a friendly error mid-stream and never the key", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.getModel.mockResolvedValue(
      new MockLanguageModelV4({
        doStream: async () => {
          throw new APICallError({
            message: "x",
            url: "https://x",
            requestBodyValues: {},
            statusCode: 429,
            responseBody: `quota ${FAKE_KEY}`,
          })
        },
      })
    )
    const text = await (
      await chat(await cookieFor("editor"), { text: "hi" })
    ).text()
    expect(text).toContain("The free Gemini quota is used up for today")
    expect(text).not.toContain(FAKE_KEY)
    expect(JSON.stringify(logged.mock.calls)).not.toContain(FAKE_KEY)
    logged.mockRestore()
  })

  it("a stopped answer is saved and audited (Review Focus 5)", async () => {
    model(streamOf(textParts("one two three four five six seven eight"), 40))
    const stop = new AbortController()
    const res = await (
      await import("@/server/api/app")
    ).app.request("/api/v1/admin/ai/chat", {
      method: "POST",
      signal: stop.signal,
      headers: {
        cookie: await cookieFor("editor"),
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: "count" }),
    })
    const reader = res.body!.getReader()
    await reader.read()
    await reader.read()
    stop.abort()
    await reader.cancel().catch(() => {})
    await vi.waitFor(async () => {
      expect(
        await getDb()
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.action, "ai.chat"))
      ).toHaveLength(1)
    })
    const rows = await getDb().select().from(aiMessages)
    expect(rows.map((r) => r.role)).toContain("user")
    // Whatever was kept of the answer is a complete, text-only message.
    for (const row of rows.filter((r) => r.role === "assistant")) {
      const parts = row.parts as { type: string; text?: string }[]
      expect(parts.every((p) => p.type === "text" && p.text?.trim())).toBe(true)
      expect(parts.map((p) => p.text).join("")).not.toContain("eight")
    }
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "ai.chat"))
    expect(log!.summary).toContain("· stopped")
  })

  it("flushes chunks as they come, not at the end", async () => {
    model(streamOf(textParts("one two three four five six seven eight"), 50))
    const res = await chat(await cookieFor("editor"), { text: "count" })
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
    const started = Date.now()
    let firstText = 0
    let seen = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      seen += value
      if (!firstText && seen.includes('"text-delta"'))
        firstText = Date.now() - started
    }
    const total = Date.now() - started
    expect(seen).toContain("eight")
    // Seven more words at 50 ms each still had to arrive after the first.
    expect(total - firstText).toBeGreaterThanOrEqual(250)
  })

  it("a failing tool reaches the model and the stream as a generic message, logged without personal data", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.seoFails = true
    const m = model(
      streamOf(toolCallParts("getSeoHealth")),
      streamOf(textParts("Sorry, I couldn't read it."))
    )
    const cs = await chunks(
      await chat(await cookieFor("editor"), { text: "seo please" })
    )
    const failed = cs.find((c) => c.type === "tool-output-error")
    expect(failed?.errorText).toBe(TOOL_FAILED)
    const prompt = JSON.stringify(m.doStreamCalls.at(-1)!.prompt)
    expect(prompt).toContain(TOOL_FAILED)
    expect(JSON.stringify(cs) + prompt).not.toMatch(/ann@example|select \*/)
    expect(logged).toHaveBeenCalledWith("[ai] tool getSeoHealth failed", {
      name: "Error",
      code: "XX000",
    })
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/ann@example/)
    const [assistant] = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.role, "assistant"))
    expect(assistant!.parts).toEqual([
      { type: "text", text: "Sorry, I couldn't read it." },
    ])
    logged.mockRestore()
  })

  it("a failed save of the new message is logged without its text", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.saveFails = true
    model(streamOf(textParts("x")))
    const res = await chat(await cookieFor("editor"), {
      text: "ann@example.com asked about leads",
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL")
    expect(JSON.stringify(body)).not.toMatch(/ann@example/)
    expect(logged).toHaveBeenCalledWith("[ai] could not save your message", {
      name: "Error",
      code: "57P01",
    })
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/ann@example/)
    logged.mockRestore()
  })
})
