import { eq, sql } from "drizzle-orm"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import {
  apiRateLimits,
  articles,
  auditLogs,
  leads,
  newsletterSubscribers,
  revisions,
  settings,
} from "@/server/db/schema"
import { findArticleBySlug } from "@/server/modules/content/repo"
import { TICK_LOCK_KEY } from "@/server/modules/scheduler/service"

import { content, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { insertLead } from "../helpers/leads"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterEach(() => vi.useRealTimers())
afterAll(closeDb)
const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const tick = (secret = process.env.CRON_SECRET) =>
  app.request("/api/v1/cron/tick", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })

async function scheduled(
  cookie: string,
  minutesAhead: number,
  overrides: Record<string, unknown> = {}
) {
  const refs = await insertTaxonomy(Math.random().toString(36).slice(2, 8))
  const created = await (
    await adminRequest("/articles", cookie, {
      method: "POST",
      body: {
        title: "Later",
        categoryId: refs.category.id,
        authorId: refs.author.id,
      },
    })
  ).json()
  const draft = content(
    {
      categoryId: refs.category.id,
      authorId: refs.author.id,
      coverId: refs.media.id,
    },
    overrides
  )
  const { version } = await (
    await adminRequest(`/articles/${created.id}/draft`, cookie, {
      method: "PATCH",
      body: { version: 1, draft },
    })
  ).json()
  const at = new Date(Date.now() + minutesAhead * 60_000).toISOString()
  const res = await adminRequest(`/articles/${created.id}/schedule`, cookie, {
    method: "POST",
    body: { version, at },
  })
  expect(res.status).toBe(200)
  return created.id as string
}

describe("cron tick", () => {
  it("refuses a missing or wrong secret", async () => {
    expect((await tick("")).status).toBe(401)
    expect((await tick("nope-nope-nope-nope-nope-nope-nope-nope")).status).toBe(
      401
    )
  })

  // Acceptance: an article scheduled 2 minutes ahead appears after the tick.
  it("publishes an article scheduled 2 minutes ahead once its time has come", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    const cookie = await cookieFor("editor")
    const id = await scheduled(cookie, 2, { slug: "later-today" })
    expect(await (await tick()).json()).toMatchObject({
      skipped: false,
      published: [],
      failed: [],
    })
    expect(await findArticleBySlug("later-today")).toBeNull()
    vi.setSystemTime(new Date(Date.now() + 2 * 60_000 + 1_000))
    expect(await (await tick()).json()).toMatchObject({
      skipped: false,
      published: [id],
      failed: [],
    })
    expect(expired()).toEqual(["articles", `article:${id}`])
    expect((await findArticleBySlug("later-today"))?.title).toBe(
      "Calm is a skill"
    )
    const [entry] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "article.publish"))
    expect(entry).toMatchObject({
      actorId: null,
      summary: "Published “Calm is a skill” on schedule",
    })
  })

  it("does nothing while another tick holds the lock (Review Focus 4)", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    await scheduled(await cookieFor("editor"), 2)
    vi.setSystemTime(new Date(Date.now() + 3 * 60_000))
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${TICK_LOCK_KEY})`)
      expect(await (await tick()).json()).toMatchObject({
        skipped: true,
        published: [],
        failed: [],
      })
    })
    expect((await (await tick()).json()).published).toHaveLength(1)
  })

  it("returns a broken scheduled draft to draft and still publishes the rest (Ruling R5)", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    const cookie = await cookieFor("editor")
    const broken = await scheduled(cookie, 2, { slug: "broken" })
    const fine = await scheduled(cookie, 2, { slug: "fine" })
    await getDb()
      .update(articles)
      .set({ draft: sql`jsonb_set(draft, '{excerpt}', '""')` })
      .where(eq(articles.id, broken))
    vi.setSystemTime(new Date(Date.now() + 3 * 60_000))
    expect(await (await tick()).json()).toMatchObject({
      skipped: false,
      published: [fine],
      failed: [broken],
    })
    const [row] = await getDb()
      .select()
      .from(articles)
      .where(eq(articles.id, broken))
    expect(row).toMatchObject({ status: "draft", scheduledFor: null })
    expect(
      await getDb()
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "article.schedule_failed"))
    ).toHaveLength(1)
    expect((await (await tick()).json()).failed).toEqual([])
  })
})

// An author's article that an editor has scheduled (Ruling: author edits to a
// scheduled article unschedule it, so the tick never publishes unreviewed copy).
async function authorScheduled() {
  const author = await cookieFor("author")
  const editor = await cookieFor("editor")
  const refs = await insertTaxonomy("own")
  const created = await (
    await adminRequest("/articles", author, {
      method: "POST",
      body: { title: "Mine", categoryId: refs.category.id },
    })
  ).json()
  const [row] = await getDb()
    .select()
    .from(articles)
    .where(eq(articles.id, created.id))
  const reviewed = content(
    {
      categoryId: refs.category.id,
      authorId: row!.authorId,
      coverId: refs.media.id,
    },
    { slug: "reviewed", title: "Reviewed copy" }
  )
  const saved = await (
    await adminRequest(`/articles/${created.id}/draft`, author, {
      method: "PATCH",
      body: { version: 1, draft: reviewed },
    })
  ).json()
  const at = new Date(Date.now() + 2 * 60_000).toISOString()
  const sched = await adminRequest(`/articles/${created.id}/schedule`, editor, {
    method: "POST",
    body: { version: saved.version, at },
  })
  expect(sched.status).toBe(200)
  return {
    id: created.id as string,
    author,
    editor,
    reviewed,
    version: (await sched.json()).version as number,
  }
}
const rowOf = async (id: string) =>
  (await getDb().select().from(articles).where(eq(articles.id, id)))[0]!

describe("author edits to a scheduled article", () => {
  it("unschedules the article, asks for review, and the tick publishes nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    const { id, author, reviewed, version } = await authorScheduled()
    const res = await adminRequest(`/articles/${id}/draft`, author, {
      method: "PATCH",
      body: {
        version,
        draft: { ...reviewed, title: "Sneaky rewrite", featured: true },
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      status: "draft",
      scheduledFor: null,
      version: version + 1,
    })
    expect(body.reviewRequestedAt).not.toBeNull()
    const row = await rowOf(id)
    expect(row).toMatchObject({
      status: "draft",
      scheduledFor: null,
      scheduledBy: null,
    })
    expect(row.reviewRequestedAt).not.toBeNull()
    expect(
      await getDb()
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "article.unscheduled"))
    ).toHaveLength(1)
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000))
    expect(await (await tick()).json()).toMatchObject({
      skipped: false,
      published: [],
      failed: [],
    })
    const after = await rowOf(id)
    expect(after).toMatchObject({
      status: "draft",
      slug: row.slug,
      title: row.title,
      publishedAt: null,
      featured: false,
    })
    expect(await findArticleBySlug("reviewed")).toBeNull()
  })

  it("does the same when an old version is restored", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    const { id, author, reviewed, version } = await authorScheduled()
    await getDb()
      .insert(revisions)
      .values({
        entityType: "article",
        entityId: id,
        version: 1,
        snapshot: { ...reviewed, title: "Old snapshot" },
      })
    const [rev] = await getDb()
      .select()
      .from(revisions)
      .where(eq(revisions.entityId, id))
    const res = await adminRequest(
      `/articles/${id}/revisions/${rev!.id}/restore`,
      author,
      { method: "POST", body: { version } }
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      status: "draft",
      scheduledFor: null,
    })
    const row = await rowOf(id)
    expect(row.status).toBe("draft")
    expect(row.reviewRequestedAt).not.toBeNull()
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000))
    expect((await (await tick()).json()).published).toEqual([])
    expect((await rowOf(id)).publishedAt).toBeNull()
  })

  it("keeps the article scheduled when an editor edits it", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date() })
    const { id, editor, reviewed, version } = await authorScheduled()
    const res = await adminRequest(`/articles/${id}/draft`, editor, {
      method: "PATCH",
      body: { version, draft: { ...reviewed, title: "Editor polish" } },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: "scheduled" })
    const row = await rowOf(id)
    expect(row.status).toBe("scheduled")
    expect(row.scheduledFor).not.toBeNull()
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000))
    expect((await (await tick()).json()).published).toEqual([id])
  })
})

describe("retention purge", () => {
  const DAY = 86_400_000
  it("purges closed leads past retention, old spam, stale pending subscribers and spent windows", async () => {
    const now = Date.now()
    await getDb()
      .insert(settings)
      .values({
        key: "privacy",
        value: { enquiryRetentionMonths: 24, spamRetentionDays: 30 },
      })
    const keepClosed = await insertLead({
      status: "closed",
      statusChangedAt: new Date(now - 700 * DAY),
    })
    await insertLead({
      status: "closed",
      statusChangedAt: new Date(now - 740 * DAY),
    })
    await insertLead({
      status: "spam",
      statusChangedAt: new Date(now - 31 * DAY),
    })
    const keepSpam = await insertLead({
      status: "spam",
      createdAt: new Date(now - 29 * DAY),
    })
    const keepNew = await insertLead({
      status: "new",
      createdAt: new Date(now - 900 * DAY),
    })
    await getDb()
      .insert(newsletterSubscribers)
      .values([
        {
          email: "stale@example.com",
          status: "pending",
          createdAt: new Date(now - 31 * DAY),
          updatedAt: new Date(now - 31 * DAY),
        },
        {
          email: "kept@example.com",
          status: "confirmed",
          createdAt: new Date(now - 900 * DAY),
        },
      ])
    await getDb()
      .insert(apiRateLimits)
      .values([
        { key: "old", count: 9, resetAt: new Date(now - 2 * DAY) },
        { key: "just-ended", count: 9, resetAt: new Date(now - 1000) },
        { key: "live", count: 1, resetAt: new Date(now + 60_000) },
      ])
    const res = await tick()
    expect((await res.json()).purged).toEqual({
      closed: 1,
      spam: 1,
      pendingSubscribers: 1,
      rateLimits: 1,
      aiConversations: 0,
    })
    expect(
      (await getDb().select({ id: leads.id }).from(leads))
        .map((r) => r.id)
        .sort()
    ).toEqual([keepClosed.id, keepSpam.id, keepNew.id].sort())
    expect(
      (await getDb().select({ key: apiRateLimits.key }).from(apiRateLimits))
        .map((r) => r.key)
        .sort()
    ).toEqual(["just-ended", "live"])
    const [entry] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "lead.purge"))
    expect(entry!.summary).toBe(
      "Retention purge: 1 closed and 1 spam enquiries, 1 unconfirmed subscriptions"
    )
  })

  it("ages spam and closed leads from when they were marked, not from signup", async () => {
    const now = Date.now()
    const old = new Date(now - 900 * DAY)
    const markedToday = await insertLead({ status: "spam", createdAt: old })
    const closedToday = await insertLead({ status: "closed", createdAt: old })
    await insertLead({
      status: "spam",
      createdAt: old,
      statusChangedAt: new Date(now - 31 * DAY),
    })
    await insertLead({
      status: "closed",
      createdAt: old,
      statusChangedAt: new Date(now - 800 * DAY),
    })
    const res = await tick()
    expect((await res.json()).purged).toMatchObject({ closed: 1, spam: 1 })
    expect(
      (await getDb().select({ id: leads.id }).from(leads))
        .map((r) => r.id)
        .sort()
    ).toEqual([markedToday.id, closedToday.id].sort())
  })

  it("keeps a pending subscriber who re-subscribed today, however old the signup", async () => {
    const now = Date.now()
    await getDb()
      .insert(newsletterSubscribers)
      .values([
        {
          email: "again@example.com",
          status: "pending",
          createdAt: new Date(now - 90 * DAY),
          tokenExpiresAt: new Date(now + 2 * DAY),
        },
        {
          email: "abandoned@example.com",
          status: "pending",
          createdAt: new Date(now - 90 * DAY),
          tokenExpiresAt: new Date(now - 60 * DAY),
        },
      ])
    const res = await tick()
    expect((await res.json()).purged).toMatchObject({ pendingSubscribers: 1 })
    expect(
      (
        await getDb()
          .select({ email: newsletterSubscribers.email })
          .from(newsletterSubscribers)
      ).map((r) => r.email)
    ).toEqual(["again@example.com"])
  })

  it("audits nothing when nothing expired", async () => {
    await tick()
    expect(
      await getDb()
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "lead.purge"))
    ).toHaveLength(0)
  })
})
