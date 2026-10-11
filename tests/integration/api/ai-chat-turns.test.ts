// tests/integration/api/ai-chat-turns.test.ts
// Regenerate, edit and screen context on POST /ai/chat.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getModel: vi.fn() }))
vi.mock("@/server/modules/ai/provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/modules/ai/provider")>()),
  getModel: mocks.getModel,
}))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { MockLanguageModelV4 } from "ai/test"
import { asc, eq } from "drizzle-orm"

import { closeDb, getDb } from "@/server/db/client"
import { aiMessages, auditLogs } from "@/server/db/schema"
import { streamOf, textParts } from "@/server/modules/ai/mock-model"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { seedAi } from "../helpers/ai"
import {
  adminRequest,
  cookieFor,
  createUser,
  signIn,
  viewAs,
} from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

const chat = (cookie: string, body: object) =>
  adminRequest("/ai/chat", cookie, { method: "POST", body })
type Chunk = { type: string; [k: string]: unknown }
const chunks = async (res: Response): Promise<Chunk[]> =>
  (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]")
    .map((l) => JSON.parse(l.slice(6)) as Chunk)
const metaOf = (cs: Chunk[]) =>
  cs.find((c) => c.type === "start")!.messageMetadata as {
    conversationId: string
    userMessageId: string
  }
const textFrom = (cs: Chunk[]) =>
  cs
    .filter((c) => c.type === "text-delta")
    .map((c) => c.delta)
    .join("")

// Each turn answers with the next scripted text.
function model(...replies: string[]) {
  const m = new MockLanguageModelV4({
    doStream: replies.map((r) => streamOf(textParts(r))),
  })
  mocks.getModel.mockResolvedValue(m)
  return m
}
const rowsOf = (conversationId: string) =>
  getDb()
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt))
const textsOf = async (conversationId: string) =>
  (await rowsOf(conversationId)).map(
    (r) =>
      `${r.role}:${(r.parts as { type: string; text?: string }[])
        .map((p) => p.text ?? "")
        .join("")}`
  )
const promptOf = (m: MockLanguageModelV4, call = -1) =>
  JSON.stringify(m.doStreamCalls.at(call)!.prompt)

// Two turns in one conversation for `cookie`.
async function twoTurns(cookie: string) {
  const first = metaOf(
    await chunks(await chat(cookie, { text: "First question" }))
  )
  const second = metaOf(
    await chunks(
      await chat(cookie, {
        conversationId: first.conversationId,
        text: "Second question",
      })
    )
  )
  return { id: first.conversationId, first, second }
}

beforeEach(async () => {
  await resetDb()
  await seedAi()
  mocks.getModel.mockReset()
})
afterAll(closeDb)

describe("the stream names the saved user message", () => {
  it("sends the saved id of the person's message in the start metadata", async () => {
    model("Answer")
    const cs = await chunks(
      await chat(await cookieFor("editor"), { text: "Hi" })
    )
    const meta = metaOf(cs)
    const [row] = await rowsOf(meta.conversationId)
    expect(row).toMatchObject({ id: meta.userMessageId, role: "user" })
  })
})

describe("regenerate", () => {
  it("drops only the last reply and answers the last question again", async () => {
    const m = model("Reply one", "Reply two", "Reply two, again")
    const cookie = await cookieFor("editor")
    const { id, second } = await twoTurns(cookie)
    const cs = await chunks(
      await chat(cookie, { conversationId: id, regenerate: true })
    )
    expect(textFrom(cs)).toBe("Reply two, again")
    expect(metaOf(cs)).toEqual({
      conversationId: id,
      userMessageId: second.userMessageId,
    })
    expect(await textsOf(id)).toEqual([
      "user:First question",
      "assistant:Reply one",
      "user:Second question",
      "assistant:Reply two, again",
    ])
    const prompt = promptOf(m)
    expect(prompt).toContain("Second question")
    expect(prompt).not.toContain('"Reply two"')
    const logs = await vi.waitFor(async () => {
      const rows = await getDb()
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "ai.chat"))
      expect(rows.some((r) => r.summary.includes("· regenerated"))).toBe(true)
      return rows
    })
    expect(JSON.stringify(logs)).not.toMatch(/question|Reply/)
  })

  it("re-runs a turn whose reply was never saved", async () => {
    model("Reply one", "Fresh")
    const cookie = await cookieFor("editor")
    const meta = metaOf(await chunks(await chat(cookie, { text: "Only" })))
    await getDb().delete(aiMessages).where(eq(aiMessages.role, "assistant"))
    await chunks(
      await chat(cookie, {
        conversationId: meta.conversationId,
        regenerate: true,
      })
    )
    expect(await textsOf(meta.conversationId)).toEqual([
      "user:Only",
      "assistant:Fresh",
    ])
  })

  it("is 404 on someone else's conversation and deletes nothing (IDOR)", async () => {
    model("Reply one", "Reply two", "Stolen")
    const { id } = await twoTurns(await cookieFor("editor"))
    const res = await chat(await cookieFor("viewer"), {
      conversationId: id,
      regenerate: true,
    })
    expect(res.status).toBe(404)
    expect(await textsOf(id)).toHaveLength(4)
  })

  it("needs a conversation and takes no text", async () => {
    model("x")
    const cookie = await cookieFor("editor")
    expect((await chat(cookie, { regenerate: true })).status).toBe(400)
    expect(
      (
        await chat(cookie, {
          conversationId: crypto.randomUUID(),
          regenerate: true,
          text: "x",
        })
      ).status
    ).toBe(400)
  })
})

describe("edit", () => {
  it("replaces the message and everything after it", async () => {
    const m = model("Reply one", "Reply two", "Reply to the edit")
    const cookie = await cookieFor("editor")
    const { id, first } = await twoTurns(cookie)
    const cs = await chunks(
      await chat(cookie, {
        conversationId: id,
        editMessageId: first.userMessageId,
        text: "First question, reworded",
      })
    )
    expect(textFrom(cs)).toBe("Reply to the edit")
    expect(await textsOf(id)).toEqual([
      "user:First question, reworded",
      "assistant:Reply to the edit",
    ])
    const [row] = await rowsOf(id)
    expect(metaOf(cs)).toEqual({ conversationId: id, userMessageId: row!.id })
    const prompt = promptOf(m)
    expect(prompt).toContain("First question, reworded")
    expect(prompt).not.toMatch(/Second question|Reply one/)
    const logs = await vi.waitFor(async () => {
      const rows = await getDb()
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "ai.chat"))
      expect(rows.some((r) => r.summary.includes("· edited"))).toBe(true)
      return rows
    })
    expect(JSON.stringify(logs)).not.toContain("reworded")
  })

  it("refuses another person's message, a reply, and a message from another conversation (IDOR)", async () => {
    model("Reply one", "Reply two", "Mine one", "Mine two", "x", "y", "z")
    const editor = await cookieFor("editor")
    const viewer = await cookieFor("viewer")
    const theirs = await twoTurns(editor)
    const mine = await twoTurns(viewer)

    // Their conversation and message: not found.
    const steal = await chat(viewer, {
      conversationId: theirs.id,
      editMessageId: theirs.first.userMessageId,
      text: "hijack",
    })
    expect(steal.status).toBe(404)
    // My conversation, their message id: not found either.
    const mixed = await chat(viewer, {
      conversationId: mine.id,
      editMessageId: theirs.first.userMessageId,
      text: "hijack",
    })
    expect(mixed.status).toBe(404)
    // A reply is not the person's message.
    const [, reply] = await rowsOf(mine.id)
    const notMine = await chat(viewer, {
      conversationId: mine.id,
      editMessageId: reply!.id,
      text: "hijack",
    })
    expect(notMine.status).toBe(404)
    expect(await textsOf(theirs.id)).toHaveLength(4)
    expect(await textsOf(mine.id)).toHaveLength(4)
    expect(JSON.stringify(await textsOf(theirs.id))).not.toContain("hijack")
  })

  it("needs a conversation, a uuid and some text", async () => {
    model("x")
    const cookie = await cookieFor("editor")
    const id = crypto.randomUUID()
    for (const body of [
      { editMessageId: id, text: "x" },
      { conversationId: id, editMessageId: "client-1", text: "x" },
      { conversationId: id, editMessageId: id },
    ])
      expect((await chat(cookie, body)).status).toBe(400)
  })
})

describe("View-as (Ruling R12)", () => {
  it("refuses regenerate and edit while viewing as someone", async () => {
    model("Reply one", "Reply two")
    await createUser("owner", "o@example.com")
    const target = await createUser("editor", "target@example.com")
    const { id, first } = await twoTurns(await signIn("target@example.com"))
    const viewing = await viewAs(await signIn("o@example.com"), target.id)
    for (const body of [
      { conversationId: id, regenerate: true },
      { conversationId: id, editMessageId: first.userMessageId, text: "x" },
    ]) {
      const res = await chat(viewing, body)
      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe("IMPERSONATION_READ_ONLY")
    }
    expect(await textsOf(id)).toHaveLength(4)
  })
})

describe("screen context", () => {
  async function seedContent() {
    const media = await insertMedia()
    const page = await insertPage({
      path: "/about",
      document: heroDocument(media.id, "About Magda, private draft words"),
    })
    const { category, author } = await insertTaxonomy()
    const article = await insertArticle({
      slug: "calm",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
      status: "draft",
    })
    return { page, article }
  }
  const systemOf = (m: MockLanguageModelV4) => {
    const first = m.doStreamCalls.at(-1)!.prompt[0]!
    return first.role === "system" ? String(first.content) : ""
  }

  it("names the open page in one line, by title, never its content", async () => {
    const { page } = await seedContent()
    const m = model("ok")
    await chunks(
      await chat(await cookieFor("editor"), {
        text: "Write a meta description for this page",
        context: {
          path: `/admin/pages/${page.id}`,
          entity: { type: "page", id: page.id },
        },
      })
    )
    const system = systemOf(m)
    const lines = system.split("\n").filter((l) => l.includes(page.id))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain("currently editing the page titled “Test page”")
    expect(lines[0]).toContain("getPage")
    expect(promptOf(m)).not.toContain("private draft words")
  })

  it("names an open article by its draft title", async () => {
    const { article } = await seedContent()
    const m = model("ok")
    await chunks(
      await chat(await cookieFor("viewer"), {
        text: "Suggest a clearer title",
        context: {
          path: `/admin/insights/${article.id}`,
          entity: { type: "article", id: article.id },
        },
      })
    )
    expect(systemOf(m)).toMatch(
      /currently editing the article titled “Title calm”/
    )
  })

  it("leaves the line out when the role can't read it or it doesn't exist", async () => {
    const { page } = await seedContent()
    const m = model("a", "b")
    await chunks(
      await chat(await cookieFor("intake"), {
        text: "hi",
        context: {
          path: "/admin/pages",
          entity: { type: "page", id: page.id },
        },
      })
    )
    expect(systemOf(m)).not.toContain("currently editing")
    expect(promptOf(m)).not.toContain(page.id)
    await chunks(
      await chat(await cookieFor("editor"), {
        text: "hi",
        context: {
          path: "/admin/pages",
          entity: { type: "page", id: crypto.randomUUID() },
        },
      })
    )
    expect(systemOf(m)).not.toContain("currently editing")
  })

  it("refuses a context that isn't an admin path and uuid", async () => {
    model("x")
    const cookie = await cookieFor("editor")
    for (const context of [
      { path: "/about" },
      { path: `/admin/${"x".repeat(200)}` },
      { path: "/admin", entity: { type: "page", id: "about" } },
      { path: "/admin", entity: { type: "lead", id: crypto.randomUUID() } },
    ]) {
      const res = await chat(cookie, { text: "hi", context })
      expect(res.status).toBe(400)
    }
  })
})
