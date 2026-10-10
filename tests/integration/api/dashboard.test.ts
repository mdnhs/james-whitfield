import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { eq, ne } from "drizzle-orm"

import { closeDb, getDb } from "@/server/db/client"
import { articles, auditLogs, newsletterSubscribers } from "@/server/db/schema"
import { weekWindow } from "@/server/modules/dashboard/week"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor, markTwoFactorEnabled } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { insertLead } from "../helpers/leads"

const eqId = (id: string) => eq(articles.id, id)
const notEqId = (id: string) => ne(articles.id, id)

beforeEach(resetDb)
afterAll(closeDb)

const HOUR = 3_600_000
const DAY = 24 * HOUR
const at = (base: Date, ms: number) => new Date(base.getTime() + ms)

async function dashboard(cookie: string) {
  const response = await adminRequest("/dashboard", cookie)
  expect(response.status).toBe(200)
  return response.json()
}

describe("GET /api/v1/admin/dashboard — enquiries", () => {
  it("counts non-spam enquiries over 30 days against the 30 before", async () => {
    const cookie = await cookieFor("owner")
    const now = new Date()
    await insertLead({ createdAt: at(now, -1 * DAY) })
    await insertLead({ createdAt: at(now, -2 * DAY), email: "b@example.com" })
    await insertLead({
      createdAt: at(now, -3 * DAY),
      status: "spam",
      email: "s@example.com",
    })
    await insertLead({ createdAt: at(now, -40 * DAY), email: "c@example.com" })

    expect((await dashboard(cookie)).enquiries).toEqual({
      value: 2,
      previous: 1,
    })
  })

  it("the 30-day windows share no instant", async () => {
    const cookie = await cookieFor("owner")
    // Exactly 30 days ago belongs to the current window only.
    const edge = new Date(Date.now() - 30 * DAY + 5_000)
    await insertLead({ createdAt: edge })
    const body = await dashboard(cookie)
    expect(body.enquiries.value + body.enquiries.previous).toBe(1)
  })

  it("counts an enquiry at 00:30 Irish Monday on that Monday", async () => {
    const cookie = await cookieFor("owner")
    const week = weekWindow(new Date())
    await insertLead({ createdAt: at(week.start, 30 * 60_000) })
    await insertLead({
      createdAt: at(week.previousStart, 2 * HOUR),
      email: "p@example.com",
    })

    const body = await dashboard(cookie)
    expect(body.enquiriesWeek).toMatchObject({ current: 1, previous: 1 })
    expect(body.enquiriesWeek.days[0]).toEqual({
      key: week.days[0]!.key,
      label: "Mon",
      current: 1,
      previous: 1,
    })
  })
})

describe("articles, subscribers and Next up", () => {
  it("counts published and scheduled articles and names the next one due", async () => {
    const cookie = await cookieFor("editor")
    const refs = await insertTaxonomy()
    const base = {
      categoryId: refs.category.id,
      authorId: refs.author.id,
      coverId: refs.media.id,
    }
    await insertArticle({ ...base, slug: "live" })
    const soon = await insertArticle({
      ...base,
      slug: "soon",
      status: "scheduled",
    })
    await insertArticle({ ...base, slug: "later", status: "scheduled" })
    await getDb()
      .update(articles)
      .set({ scheduledFor: new Date(Date.now() + DAY) })
      .where(eqId(soon.id))
    await getDb()
      .update(articles)
      .set({ scheduledFor: new Date(Date.now() + 3 * DAY) })
      .where(notEqId(soon.id))

    const body = await dashboard(cookie)
    expect(body.articles).toEqual({ published: 1, scheduled: 2 })
    expect(body.nextUp[0]).toMatchObject({
      id: "article",
      href: `/admin/insights/${soon.id}`,
      done: false,
    })
  })

  it("counts confirmed subscribers and those confirmed in 30 days", async () => {
    const cookie = await cookieFor("owner")
    const now = new Date()
    await getDb()
      .insert(newsletterSubscribers)
      .values([
        {
          email: "a@example.com",
          status: "confirmed",
          confirmedAt: at(now, -2 * DAY),
        },
        {
          email: "b@example.com",
          status: "confirmed",
          confirmedAt: at(now, -60 * DAY),
        },
        { email: "c@example.com", status: "pending" },
        {
          email: "d@example.com",
          status: "unsubscribed",
          confirmedAt: at(now, -1 * DAY),
        },
      ])
    expect((await dashboard(cookie)).subscribers).toEqual({
      confirmed: 2,
      newThisMonth: 1,
    })
  })

  it("puts the oldest uncontacted enquiry first for someone with lead.read", async () => {
    const cookie = await cookieFor("intake")
    const now = new Date()
    const oldest = await insertLead({
      name: "Nora Byrne",
      createdAt: at(now, -3 * DAY),
    })
    await insertLead({ createdAt: at(now, -1 * DAY), email: "x@example.com" })
    await insertLead({
      createdAt: at(now, -9 * DAY),
      status: "contacted",
      email: "y@example.com",
    })

    const [first] = (await dashboard(cookie)).nextUp
    expect(first).toMatchObject({
      id: "enquiry",
      title: "Reply to Nora",
      cta: "Open enquiry",
      href: `/admin/leads?lead=${oldest.id}`,
      done: false,
    })
  })

  it("a marketer gets enquiry counts but no enquiry in Next up (docs/brief.md §7.2)", async () => {
    const cookie = await cookieFor("marketer")
    await insertLead({ name: "Nora Byrne" })
    const body = await dashboard(cookie)
    expect(body.enquiries.value).toBe(1)
    expect(JSON.stringify(body)).not.toContain("Nora")
    expect(body.nextUp.map((item: { id: string }) => item.id)).not.toContain(
      "enquiry"
    )
    expect(body.recentActivity).toBeNull()
  })
})

describe("RBAC and empty states", () => {
  it("a fresh install answers zeros everywhere", async () => {
    const cookie = await cookieFor("owner")
    await getDb().delete(auditLogs)
    const body = await dashboard(cookie)
    expect(body.enquiries).toEqual({ value: 0, previous: 0 })
    expect(body.enquiriesWeek.current + body.enquiriesWeek.previous).toBe(0)
    expect(body.articles).toEqual({ published: 0, scheduled: 0 })
    expect(body.subscribers).toEqual({ confirmed: 0, newThisMonth: 0 })
    expect(body.seoHealth).toEqual({ score: 100, issues: 0 })
    expect(body.contentHealth).toMatchObject({
      complete: 0,
      needsWork: 0,
      missing: 0,
      total: 0,
    })
    expect(body.nextUp.map((item: { id: string }) => item.id)).toEqual([
      "two-factor",
      "invite",
    ])
  })

  it("an intake person gets no SEO or content health (no seo.read)", async () => {
    const body = await dashboard(await cookieFor("intake"))
    expect(body.seoHealth).toBeNull()
    expect(body.contentHealth).toBeNull()
    expect(body.recentActivity).toBeNull()
  })

  it("a viewer gets the gauge but not the findings (no page.update)", async () => {
    const body = await dashboard(await cookieFor("viewer"))
    expect(body.contentHealth).not.toBeNull()
    expect(body.contentHealth.findings).toBeNull()
    // Two-factor is optional for a viewer, so it is not called required.
    expect(body.nextUp.at(-1).description).not.toMatch(/required/i)
  })

  it("an owner gets team activity", async () => {
    const body = await dashboard(await cookieFor("owner"))
    expect(body.recentActivity[0]).toMatchObject({ action: "auth.sign_in" })
    expect(typeof body.recentActivity[0].createdAt).toBe("string")
  })
})

// Change 2026-10-11: two-factor is a recommendation in "Next up", never a gate.
describe("GET /api/v1/admin/dashboard — two-factor recommendation", () => {
  const step = (body: { nextUp: { id: string }[] }) =>
    body.nextUp.find((item) => item.id === "two-factor")

  it("urges an owner without two-factor, with a reason, linking to Security", async () => {
    const body = await dashboard(await cookieFor("owner"))
    expect(step(body)).toMatchObject({
      title: "Turn on two-factor authentication",
      description: expect.stringMatching(/^Strongly recommended for your role/),
      href: "/admin/account?tab=security",
      done: false,
    })
  })

  it("recommends it to other roles without the role reason", async () => {
    const body = await dashboard(await cookieFor("editor"))
    expect(step(body)).toMatchObject({
      description: expect.stringMatching(/^Recommended\./),
      done: false,
    })
  })

  it("stops recommending it once it is on", async () => {
    const cookie = await cookieFor("owner")
    await markTwoFactorEnabled("owner@example.com")
    const body = await dashboard(cookie)
    expect(step(body)).toMatchObject({ title: "Two-factor is on", done: true })
  })
})
