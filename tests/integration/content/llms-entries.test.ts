import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// 'use cache' is inert outside Next; its helpers must be too.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb } from "@/server/db/client"
import { getLlmsEntries, getSitemapEntries } from "@/server/modules/seo/queries"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("sitemap and llms.txt entries", () => {
  it("run against the database and include a category hub", async () => {
    const { category, author, media } = await insertTaxonomy("sleep")
    await insertArticle({
      slug: "live-one",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    })
    const hub = "/insights/category/cat-sleep"
    const sitemap = await getSitemapEntries()
    const llms = await getLlmsEntries()
    expect(sitemap.map((e) => e.path)).toContain(hub)
    expect(sitemap.map((e) => e.path)).toContain("/insights/live-one")
    expect(llms.map((e) => e.path).sort()).toEqual(
      expect.arrayContaining([hub, "/insights/live-one"])
    )
    expect(llms.find((e) => e.path === hub)).toMatchObject({
      kind: "page",
      title: "Category sleep",
      noindex: false,
    })
  })
})
