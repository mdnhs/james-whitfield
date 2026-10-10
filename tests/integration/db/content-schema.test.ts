// tests/integration/db/content-schema.test.ts
import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  authors,
  media,
  pages,
  redirects,
} from "@/server/db/schema"

import { insertArticle, insertTaxonomy } from "../helpers/articles"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

async function seedArticle(title: string, bodyText: string) {
  const db = getDb()
  const [image] = await db
    .insert(media)
    .values({
      driver: "static",
      key: "/images/a.png",
      url: "/images/a.png",
      filename: "a.png",
      mimeType: "image/png",
      sizeBytes: 1,
    })
    .returning()
  const [category] = await db
    .insert(articleCategories)
    .values({ slug: "sleep", name: "Sleep" })
    .returning()
  const [author] = await db
    .insert(authors)
    .values({ slug: "magda", name: "Magda", avatarId: image.id })
    .returning()
  const doc = { type: "doc" as const, content: [] }
  return db
    .insert(articles)
    .values({
      slug: "a",
      title,
      excerpt: "Rest well",
      coverId: image.id,
      categoryId: category.id,
      authorId: author.id,
      body: doc,
      bodyText,
    })
    .returning()
}

describe("content schema", () => {
  it("maintains a weighted search vector behind a GIN index", async () => {
    await seedArticle("Calm is a skill", "breathing practice")
    const { rows } = await getDb().execute<{ hit: boolean }>(
      sql`select search @@ websearch_to_tsquery('english', 'breathing') as hit from articles`
    )
    expect(rows[0].hit).toBe(true)
    const index = await getDb().execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where indexname = 'articles_search_idx'`
    )
    expect(index.rows[0].indexdef).toMatch(/USING gin/)
  })

  it("refuses to delete media still used by an article", async () => {
    await seedArticle("T", "")
    // Drizzle 0.45 wraps driver errors (DrizzleQueryError); the pg code is on `cause`.
    await expect(getDb().delete(media)).rejects.toMatchObject({
      cause: { code: "23503" },
    })
  })

  it("keeps page paths and system keys unique", async () => {
    const doc = { blocks: [] }
    await getDb().insert(pages).values({
      path: "/about",
      systemKey: "about",
      title: "About",
      draft: doc,
    })
    await expect(
      getDb()
        .insert(pages)
        .values({ path: "/about", title: "Again", draft: doc })
    ).rejects.toMatchObject({ cause: { code: "23505" } })
  })
})

describe("insights schema", () => {
  it("allows one featured article", async () => {
    const { category, author, media } = await insertTaxonomy()
    const refs = {
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    }
    await insertArticle({ ...refs, slug: "one", featured: true })
    await expect(
      insertArticle({ ...refs, slug: "two", featured: true })
    ).rejects.toThrow()
  })
  it("allows a draft without a cover", async () => {
    const { category, author } = await insertTaxonomy()
    await expect(
      getDb()
        .insert(articles)
        .values({
          slug: "nocover",
          title: "T",
          excerpt: "",
          categoryId: category.id,
          authorId: author.id,
          body: { type: "doc", content: [] },
        })
    ).resolves.toBeDefined()
  })
  it("refuses odd redirect codes and self-redirects", async () => {
    await expect(
      getDb()
        .insert(redirects)
        .values({ sourcePath: "/a", destination: "/b", statusCode: 200 })
    ).rejects.toThrow()
    await expect(
      getDb().insert(redirects).values({ sourcePath: "/a", destination: "/a" })
    ).rejects.toThrow()
  })
})
