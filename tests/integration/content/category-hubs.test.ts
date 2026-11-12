import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { articleCategories } from "@/server/db/schema"
import { findCategoryBySlug } from "@/server/modules/content/repo"
import { listCategoryHubs } from "@/server/modules/seo/live"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("category hubs", () => {
  it("lists a hub only for categories with a published article", async () => {
    const { category, author, media } = await insertTaxonomy("sleep")
    expect(await listCategoryHubs()).toEqual([])

    const refs = {
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    }
    await insertArticle({ slug: "draft-one", status: "draft", ...refs })
    expect(await listCategoryHubs()).toEqual([])

    await insertArticle({ slug: "live-one", ...refs })
    const hubs = await listCategoryHubs()
    expect(hubs.map((h) => h.path)).toEqual(["/insights/category/cat-sleep"])
  })

  it("leaves out a hidden category", async () => {
    const { category, author, media } = await insertTaxonomy("hid")
    await insertArticle({
      slug: "live-two",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    })
    await getDb()
      .update(articleCategories)
      .set({ isVisible: false })
      .where(eq(articleCategories.id, category.id))
    expect(await listCategoryHubs()).toEqual([])
    expect(await findCategoryBySlug("cat-hid")).toBeNull()
  })

  it("finds a visible category with its SEO fields", async () => {
    await insertTaxonomy("seo")
    await getDb()
      .update(articleCategories)
      .set({ seoTitle: "Custom", description: "Intro" })
    expect(await findCategoryBySlug("cat-seo")).toMatchObject({
      name: "Category seo",
      description: "Intro",
      seoTitle: "Custom",
      seoDescription: "",
    })
    expect(await findCategoryBySlug("nope")).toBeNull()
  })
})
