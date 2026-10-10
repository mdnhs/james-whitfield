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
import { articles, auditLogs } from "@/server/db/schema"
import { findArticleBySlug } from "@/server/modules/content/repo"
import { TICK_LOCK_KEY } from "@/server/modules/scheduler/service"

import { content, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

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
    expect(await (await tick()).json()).toEqual({
      skipped: false,
      published: [],
      failed: [],
    })
    expect(await findArticleBySlug("later-today")).toBeNull()
    vi.setSystemTime(new Date(Date.now() + 2 * 60_000 + 1_000))
    expect(await (await tick()).json()).toEqual({
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
      expect(await (await tick()).json()).toEqual({
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
    expect(await (await tick()).json()).toEqual({
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
