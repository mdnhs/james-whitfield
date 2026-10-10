import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// 'use cache' is inert outside Next; its helpers must be too.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { pages } from "@/server/db/schema"
import { getSitemapEntries } from "@/server/modules/seo/queries"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

const document = {
  blocks: [],
} as unknown as (typeof pages.$inferInsert)["draft"]

const page = (
  path: string,
  extra: Partial<typeof pages.$inferInsert> = {}
): typeof pages.$inferInsert => ({
  path,
  title: path,
  status: "published",
  draft: document,
  published: document,
  ...extra,
})

describe("getSitemapEntries", () => {
  it("lists published, indexable pages and articles only", async () => {
    const { media, category, author } = await insertTaxonomy()
    const article = await insertArticle({
      slug: "calm",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    })
    await getDb()
      .insert(pages)
      .values([
        page("/about"),
        page("/hidden", { seo: { noindex: true } }),
        page("/elsewhere", { seo: { canonical: "https://other.example/x" } }),
        page("/draft", { status: "draft", published: null }),
      ])
    const entries = await getSitemapEntries()
    expect(entries.map((e) => e.path).sort()).toEqual(
      ["/about", `/insights/${article.slug}`].sort()
    )
    for (const e of entries)
      expect(Number.isNaN(Date.parse(e.lastModified))).toBe(false)
  })
})
