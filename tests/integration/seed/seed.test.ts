import { readdir } from "node:fs/promises"

import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { pageDocumentFor } from "@/blocks/page"
import { DEFAULT_THEME } from "@/lib/theme/schema"
import { ARTICLE_BODIES } from "@/server/db/seed/fixtures/article-bodies"
import { ALL_ARTICLES } from "@/server/db/seed/fixtures/articles"
import { closeDb, getDb } from "@/server/db/client"
import { pages, services, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  findArticleBySlug,
  listArticleSummaries,
} from "@/server/modules/content/repo"

import { resetDb } from "../helpers/db"

const TABLES = [
  "media",
  "services",
  "plans",
  "testimonials",
  "faqs",
  "process_steps",
  "cta_bands",
  "article_categories",
  "authors",
  "articles",
  "pages",
  "settings",
]

async function counts() {
  const out: Record<string, number> = {}
  for (const table of TABLES) {
    const { rows } = await getDb().execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table)}`
    )
    out[table] = rows[0].n
  }
  return out
}

beforeAll(async () => {
  await resetDb()
  await seedContent()
})
afterAll(closeDb)

// Review Focus 5.
describe("content seed", () => {
  it("fills every table, and a second run changes nothing", async () => {
    const images = (await readdir("public/images", { recursive: true })).filter(
      (f) => /\.(png|jpe?g|webp|svg)$/i.test(f)
    )
    const first = await counts()
    expect(first).toEqual({
      media: images.length,
      services: 6,
      plans: 3,
      testimonials: 7,
      faqs: 7,
      process_steps: 4,
      cta_bands: 2,
      article_categories: 5,
      authors: 4,
      articles: 7,
      pages: 9,
      settings: 14,
    })
    expect(await seedContent({ force: true })).toMatchObject({ skipped: false })
    expect(await counts()).toEqual(first)
    await seedContent()
    expect(await counts()).toEqual(first)
  })

  it("never overwrites a row an editor changed", async () => {
    await getDb()
      .update(services)
      .set({ title: "Edited" })
      .where(eq(services.slug, "sleep-rest"))
    await seedContent()
    const [row] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "sleep-rest"))
    expect(row.title).toBe("Edited")
  })

  it("seeds documents that pass their page rules (fixture validation)", async () => {
    for (const page of await getDb().select().from(pages)) {
      const kind = (page.systemKey ?? "custom") as Parameters<
        typeof pageDocumentFor
      >[0]
      expect(
        pageDocumentFor(kind).safeParse(page.draft).success,
        page.path
      ).toBe(true)
    }
  })

  it("keeps the legal pages as flagged drafts", async () => {
    const legal = await getDb()
      .select()
      .from(pages)
      .where(sql`${pages.path} in ('/privacy', '/terms', '/disclaimer')`)
    expect(legal).toHaveLength(3)
    for (const page of legal) {
      expect(page.status).toBe("draft")
      expect(page.published).toBeNull()
      expect(page.settings).toMatchObject({ needsReview: true })
    }
  })

  it("keeps article order, date labels and reading times", async () => {
    const summaries = await listArticleSummaries()
    expect(summaries.map((a) => a.slug)).toEqual(
      ALL_ARTICLES.map((a) => a.slug)
    )
    expect(summaries.map((a) => a.date.label)).toEqual(
      ALL_ARTICLES.map((a) => a.date.label)
    )
    for (const a of summaries) {
      const words = ARTICLE_BODIES[a.slug]
        .flatMap((b) => (b.type === "list" ? b.items : [b.text]))
        .join(" ")
        .split(/\s+/).length
      expect(a.readingMinutes, a.slug).toBe(
        Math.max(1, Math.round(words / 220))
      )
    }
    expect((await findArticleBySlug("calm-is-a-skill"))?.topicSlug).toBe(
      "anxiety-stress"
    )
  })

  // The default theme resolves to site.css (tests/css/theme-presets.test.ts).
  it("seeds the default theme", async () => {
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "theme"))
    expect(row.value).toEqual(DEFAULT_THEME)
  })

  it("keeps the clinic photo on the block only", async () => {
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "contact"))
    expect(
      (row.value as { clinic: { photo: unknown } }).clinic.photo
    ).toBeNull()
  })
})
