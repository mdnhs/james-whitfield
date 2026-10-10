// tests/integration/ai/tools.test.ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// The dashboard's content report is a "use cache" function.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { toActor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"
import {
  hasPermission,
  ROLE_NAMES,
  type RoleName,
} from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { articles, pages } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { parseAiSettings } from "@/server/modules/ai/settings"
import {
  dashboardSummary,
  enquiryStats,
  readArticle,
  readPage,
  searchContent,
  seoHealth,
} from "@/server/modules/ai/tool-data"
import { buildTools } from "@/server/modules/ai/tools"

import { cookieFor } from "../helpers/auth"
import { content, insertArticle, insertTaxonomy } from "../helpers/articles"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"
import { insertLead } from "../helpers/leads"

async function actorFor(role: RoleName) {
  const cookie = await cookieFor(role)
  const session = await getAuth().api.getSession({
    headers: new Headers({ cookie }),
  })
  return toActor(session!)
}
const off = parseAiSettings({})
const shared = parseAiSettings({ shareEnquiryDetails: { enabled: true } })

beforeEach(resetDb)
afterAll(closeDb)

describe("buildTools (RBAC)", () => {
  it("gives intake only the dashboard and enquiry numbers", async () => {
    expect(
      Object.keys(
        buildTools({ actor: await actorFor("intake"), settings: off })
      ).sort()
    ).toEqual(["getDashboardSummary", "getEnquiryStats"])
  })
  it("gives a viewer the read tools but no enquiry details", async () => {
    expect(
      Object.keys(
        buildTools({ actor: await actorFor("viewer"), settings: off })
      ).sort()
    ).toEqual([
      "getArticle",
      "getDashboardSummary",
      "getEnquiryStats",
      "getPage",
      "getSeoHealth",
      "searchContent",
    ])
  })
})

describe("pages and articles", () => {
  it("finds pages and articles, drafts included (Ruling R13)", async () => {
    const media = await insertMedia()
    await insertPage({
      path: "/about",
      document: heroDocument(media.id, "About Magda"),
    })
    const { category, author } = await insertTaxonomy()
    await insertArticle({
      slug: "calm",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
      status: "draft",
    })
    const viewer = await actorFor("viewer")
    const found = await searchContent(viewer, "about")
    expect(found.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "page",
          path: "/about",
          status: "draft",
        }),
      ])
    )
    const page = await readPage(viewer, "/about/")
    expect(page).toMatchObject({
      label: "Test page page",
      path: "/about",
      truncated: false,
    })
    expect(page.text).toContain("About Magda")
    const article = await readArticle(viewer, "calm")
    expect(article).toMatchObject({ status: "draft", path: "/insights/calm" })
  })

  it("refuses inside the tool when the role lacks the permission", async () => {
    const intake = await actorFor("intake")
    expect(await readPage(intake, "/about")).toMatchObject({
      error: expect.stringMatching(/access/),
    })
    expect(await seoHealth(intake)).toMatchObject({
      error: expect.stringMatching(/access/),
    })
    expect(await searchContent(intake, "about")).toMatchObject({
      error: expect.stringMatching(/access/),
    })
  })

  it("says when nothing matches", async () => {
    expect(await readPage(await actorFor("editor"), "/nowhere")).toMatchObject({
      error: expect.stringMatching(/No page/),
    })
  })
})

describe("dashboard", () => {
  it("the dashboard tool never carries names or emails (Review Focus 3)", async () => {
    await insertLead({ name: "Ann Byrne", email: "ann@example.com" })
    const summary = await dashboardSummary(await actorFor("owner"))
    const text = JSON.stringify(summary)
    expect(text).not.toMatch(/Ann|ann@example\.com|@example/)
    expect(summary).not.toHaveProperty("nextUp")
    expect(summary).not.toHaveProperty("recentActivity")
  })
})

describe("enquiry stats (Ruling R14)", () => {
  beforeEach(async () => {
    for (let i = 0; i < 22; i++)
      await insertLead({
        name: `Person${i} Surname`,
        email: `p${i}@example.com`,
        phone: "+353861234567",
        message: "m".repeat(800),
        createdAt: new Date(Date.now() - i * 3_600_000),
      })
    await insertLead({ name: "Spammy", status: "spam" })
  })

  it("gives counts to every role and nothing personal", async () => {
    const stats = await enquiryStats(await actorFor("viewer"), shared, "30d")
    expect(stats.total).toBe(22)
    expect(stats.byStatus).toEqual({ new: 22 })
    expect(stats).not.toHaveProperty("recent")
    expect(JSON.stringify(stats)).not.toMatch(
      /Person|example\.com|353|mmmm|Spammy/
    )
  })

  it("details need both the opt-in and lead.read (Review Focus 3)", async () => {
    expect(
      await enquiryStats(await actorFor("owner"), off, "30d")
    ).not.toHaveProperty("recent")
    const stats = await enquiryStats(await actorFor("intake"), shared, "30d")
    const recent = stats.recent as {
      firstName: string
      message: string
      topic: string
      date: string
    }[]
    expect(recent).toHaveLength(20)
    expect(recent[0]).toMatchObject({ firstName: "Person0", topic: "anxiety" })
    expect(recent[0]!.message.length).toBe(500)
    expect(JSON.stringify(recent)).not.toMatch(/Surname|example\.com|353/)
  })
})

// GDPR Art. 9: what the model can see of an enquiry, every role, every tool.
describe("enquiry privacy across every role and tool", () => {
  const PERSONAL =
    /Siobhan|Secretname|private\.ie|353869|SECRET-MESSAGE|IPHASH-SECRET|UA-SECRET/
  const inputs: Record<string, unknown> = {
    searchContent: { query: "about" },
    getPage: { idOrPath: "/about" },
    getArticle: { idOrSlug: "calm" },
    getSeoHealth: {},
    getDashboardSummary: {},
    getEnquiryStats: { range: "365d" },
  }
  const runAll = async (role: RoleName, settings: typeof off) => {
    const tools = buildTools({ actor: await actorFor(role), settings })
    const outputs: Record<string, unknown> = {}
    for (const [name, t] of Object.entries(tools))
      outputs[name] = await t.execute!(inputs[name], {
        toolCallId: `call-${name}`,
        messages: [],
        context: undefined,
      })
    return outputs
  }

  beforeEach(async () => {
    await insertLead({
      name: "Siobhan Secretname",
      email: "siobhan@private.ie",
      phone: "+353869999999",
      message: "SECRET-MESSAGE about my week",
      ipHash: "IPHASH-SECRET",
      userAgent: "UA-SECRET",
    })
    const media = await insertMedia()
    await insertPage({
      path: "/about",
      document: heroDocument(media.id, "About Magda"),
    })
  })

  it("with sharing off, no output carries personal data for any role", async () => {
    for (const role of ROLE_NAMES) {
      const outputs = await runAll(role, off)
      expect(outputs.getEnquiryStats, role).toMatchObject({ total: 1 })
      expect(outputs.getEnquiryStats, role).not.toHaveProperty("recent")
      expect(JSON.stringify(outputs), role).not.toMatch(PERSONAL)
    }
  })

  it("with sharing on, only lead.read roles see first name, topic, date and message", async () => {
    for (const role of ROLE_NAMES) {
      const outputs = await runAll(role, shared)
      const stats = outputs.getEnquiryStats as Record<string, unknown>
      const text = JSON.stringify(outputs)
      // Surname, email, phone, IP and user agent never leave, for anyone.
      expect(text, role).not.toMatch(
        /Secretname|private\.ie|353869|IPHASH-SECRET|UA-SECRET/
      )
      if (hasPermission([role], { lead: ["read"] })) {
        expect(stats.recent, role).toEqual([
          {
            firstName: "Siobhan",
            topic: "anxiety",
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            message: "SECRET-MESSAGE about my week",
          },
        ])
      } else {
        expect(stats, role).not.toHaveProperty("recent")
        expect(text, role).not.toMatch(PERSONAL)
      }
    }
  })
})

describe("output size caps", () => {
  it("clips a long page to 8 000 characters and says so", async () => {
    const media = await insertMedia()
    await insertPage({
      path: "/long",
      document: heroDocument(media.id, `Long ${"word ".repeat(3000)}`),
    })
    const page = await readPage(await actorFor("editor"), "/long")
    expect(page).toMatchObject({ truncated: true })
    expect((page.text as string).length).toBe(8000)
  })

  it("reads a page whose stored SEO no longer fits the schema (degrades to empty SEO)", async () => {
    const media = await insertMedia()
    const row = await insertPage({
      path: "/drifted",
      document: heroDocument(media.id, "Drifted"),
    })
    await getDb()
      .update(pages)
      .set({ seo: { title: "x".repeat(500), noindex: "yes" } as never })
      .where(eq(pages.id, row.id))
    const page = await readPage(await actorFor("editor"), "/drifted")
    expect(page).toMatchObject({
      seo: { title: null, description: null, noindex: false },
    })
  })

  it("clips an article excerpt to 500 characters", async () => {
    const media = await insertMedia()
    const { category, author } = await insertTaxonomy()
    const row = await insertArticle({
      slug: "long-excerpt",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    })
    await getDb()
      .update(articles)
      .set({ excerpt: "e".repeat(900) })
      .where(eq(articles.id, row.id))
    const article = await readArticle(await actorFor("editor"), "long-excerpt")
    expect((article.excerpt as string).length).toBe(500)
  })
})

describe("Task 3 review carries", () => {
  it("dates recent enquiries in Dublin time", async () => {
    // 23:30 UTC on 10 July is 00:30 on 11 July in Dublin (IST).
    await insertLead({
      name: "Late Enquirer",
      createdAt: new Date("2026-07-10T23:30:00Z"),
    })
    const stats = await enquiryStats(
      await actorFor("owner"),
      shared,
      "30d",
      new Date("2026-07-20T12:00:00Z")
    )
    expect(stats.recent).toEqual([
      expect.objectContaining({ firstName: "Late", date: "2026-07-11" }),
    ])
  })

  it("an article slug prefers the live slug, then the newest draft slug", async () => {
    const media = await insertMedia()
    const { category, author } = await insertTaxonomy()
    const refs = {
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    }
    const article = (slug: string) => insertArticle({ slug, ...refs })
    const setDraft = (id: string, slug: string, updatedAt: Date) =>
      getDb()
        .update(articles)
        .set({ draft: content(refs, { slug }), updatedAt })
        .where(eq(articles.id, id))
    // Renamed in draft to "calm", inserted first and edited most recently.
    const renamed = await article("calm-old")
    await setDraft(renamed.id, "calm", new Date("2026-09-01T00:00:00Z"))
    const live = await article("calm")
    await getDb()
      .update(articles)
      .set({ updatedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(articles.id, live.id))
    const older = await article("older")
    const newer = await article("newer")
    await setDraft(newer.id, "fresh", new Date("2026-08-01T00:00:00Z"))
    await setDraft(older.id, "fresh", new Date("2026-02-01T00:00:00Z"))
    const editor = await actorFor("editor")
    expect(await readArticle(editor, "calm")).toMatchObject({ id: live.id })
    expect(await readArticle(editor, "/insights/fresh")).toMatchObject({
      id: newer.id,
    })
  })
})
