import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, leadActivities, users } from "@/server/db/schema"

import {
  adminRequest,
  cookieFor,
  createUser,
  signIn,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { insertLead } from "../helpers/leads"

beforeEach(resetDb)
afterAll(closeDb)

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms)

async function bell(cookie: string) {
  const response = await adminRequest("/notifications", cookie)
  expect(response.status).toBe(200)
  return response.json()
}

async function seedEverything(submitterId: string | null = null) {
  const lead = await insertLead({ name: "Nora Byrne", createdAt: ago(60_000) })
  await insertLead({
    status: "spam",
    email: "spam@example.com",
    createdAt: ago(60_000),
  })
  await getDb()
    .insert(leadActivities)
    .values({
      leadId: lead.id,
      type: "email",
      data: { kind: "auto-reply", status: "failed", error: "unknown" },
    })
  const row = (action: string, actorId: string | null = null) => ({
    action,
    actorId,
    entityType: action.startsWith("tracking") ? "setting" : "article",
    entityId: "a1",
    summary: `${action} summary`,
    createdAt: ago(30_000),
  })
  await getDb()
    .insert(auditLogs)
    .values([
      row("article.publish"),
      row("article.schedule_failed"),
      row("article.submit", submitterId),
      row("tracking.capi_failed"),
    ])
  return lead
}

const kinds = (body: { items: { kind: string }[] }) =>
  body.items.map((i) => i.kind).sort()

describe("GET /api/v1/admin/notifications", () => {
  it("each role gets only the items its permissions allow (Ruling R6)", async () => {
    const author = await createUser("author", "writer@example.com")
    await seedEverything(author.id)
    // Make every account old enough that the items are unread.
    const expect_ = async (
      role: Parameters<typeof cookieFor>[0],
      expected: string[]
    ) => {
      const cookie = await cookieFor(role)
      await getDb()
        .update(users)
        .set({ createdAt: ago(DAY) })
      expect(kinds(await bell(cookie)), role).toEqual(expected.sort())
    }
    await expect_("intake", ["enquiry", "delivery_failed"])
    await expect_("marketer", ["capi_failed", "published"])
    await expect_("editor", [
      "published",
      "schedule_failed",
      "review_requested",
    ])
    await expect_("viewer", ["published"])
    await expect_("owner", [
      "capi_failed",
      "delivery_failed",
      "enquiry",
      "published",
      "review_requested",
      "schedule_failed",
    ])
  })

  it("never shows a spam lead, and names the enquirer by first name only", async () => {
    const lead = await seedEverything()
    const cookie = await cookieFor("intake")
    await getDb()
      .update(users)
      .set({ createdAt: ago(DAY) })
    const enquiry = (await bell(cookie)).items.find(
      (i: { kind: string }) => i.kind === "enquiry"
    )
    expect(enquiry).toMatchObject({
      title: "New enquiry",
      description: "From Nora",
      href: `/admin/leads?lead=${lead.id}`,
      unread: true,
    })
    expect(JSON.stringify(await bell(cookie))).not.toContain("Byrne")
  })

  it("a review request is not shown to the person who submitted it", async () => {
    const submitter = await createUser("editor", "ed@example.com")
    await seedEverything(submitter.id)
    expect(kinds(await bell(await signIn("ed@example.com")))).not.toContain(
      "review_requested"
    )
    // Another editor still sees it.
    expect(kinds(await bell(await cookieFor("editor")))).toContain(
      "review_requested"
    )
  })

  it("a new account starts with nothing unread", async () => {
    await seedEverything()
    const body = await bell(await cookieFor("owner"))
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.unread).toBe(0)
  })

  it("keeps 30 days and the newest 20", async () => {
    for (let i = 0; i < 25; i++) {
      await insertLead({
        email: `p${i}@example.com`,
        createdAt: ago(i * 60_000 + 1_000),
      })
    }
    await insertLead({ email: "old@example.com", createdAt: ago(31 * DAY) })
    const cookie = await cookieFor("intake")
    await getDb()
      .update(users)
      .set({ createdAt: ago(40 * DAY) })
    const body = await bell(cookie)
    expect(body.items).toHaveLength(20)
    expect(body.unread).toBe(20)
    expect(Date.parse(body.items[0].at)).toBeGreaterThan(
      Date.parse(body.items[19].at)
    )
  })

  it("POST /seen clears unread until something newer arrives", async () => {
    await seedEverything()
    const cookie = await cookieFor("intake")
    await getDb()
      .update(users)
      .set({ createdAt: ago(DAY) })
    expect((await bell(cookie)).unread).toBe(2)

    const seen = await adminRequest("/notifications/seen", cookie, {
      method: "POST",
    })
    expect(seen.status).toBe(200)
    expect((await bell(cookie)).unread).toBe(0)

    await insertLead({
      email: "later@example.com",
      createdAt: new Date(Date.now() + 1_000),
    })
    expect((await bell(cookie)).unread).toBe(1)
  })

  it("View-as never marks notifications read (Ruling R9)", async () => {
    await seedEverything()
    const intake = await createUser("intake", "ivy@example.com")
    await getDb()
      .update(users)
      .set({ createdAt: ago(DAY) })
      .where(eq(users.id, intake.id))
    const owner = await cookieFor("owner")
    const viewing = await viewAs(owner, intake.id)

    expect((await bell(viewing)).unread).toBe(2)
    const refused = await adminRequest("/notifications/seen", viewing, {
      method: "POST",
    })
    expect(refused.status).toBe(403)
    expect((await refused.json()).error.code).toBe("IMPERSONATION_READ_ONLY")
    expect((await bell(await signIn("ivy@example.com"))).unread).toBe(2)
  })
})
