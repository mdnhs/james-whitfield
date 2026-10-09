import { describe, expect, it } from "vitest"

import { ALL_ARTICLES } from "@/server/db/seed/fixtures/articles"

import { ARTICLE_SHELL_SLUG, ArticleSlug } from "@/lib/content/article-slug"

describe("ArticleSlug", () => {
  it("rejects the build-shell slug", () => {
    expect(ArticleSlug.safeParse(ARTICLE_SHELL_SLUG).success).toBe(false)
  })

  it("accepts every seeded article slug", () => {
    for (const { slug } of ALL_ARTICLES) {
      expect(ArticleSlug.safeParse(slug).success, slug).toBe(true)
    }
  })
})
