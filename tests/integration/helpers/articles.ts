import { getDb } from "@/server/db/client"
import { articleCategories, articles, authors } from "@/server/db/schema"

import { insertMedia } from "./content"

export const bodyDoc = (text = "A calm lead paragraph.") => ({
  type: "doc" as const,
  content: [
    { type: "paragraph" as const, content: [{ type: "text" as const, text }] },
  ],
})

export async function insertTaxonomy(suffix = "a") {
  const media = await insertMedia()
  const [category] = await getDb()
    .insert(articleCategories)
    .values({ slug: `cat-${suffix}`, name: `Category ${suffix}` })
    .returning()
  const [author] = await getDb()
    .insert(authors)
    .values({
      slug: `author-${suffix}`,
      name: `Author ${suffix}`,
      avatarId: media.id,
    })
    .returning()
  return { media, category: category!, author: author! }
}

type Status = "draft" | "scheduled" | "published" | "archived"
export async function insertArticle(values: {
  slug: string
  categoryId: string
  authorId: string
  coverId: string
  status?: Status
  featured?: boolean
  createdBy?: string | null
}) {
  const status = values.status ?? "published"
  const [row] = await getDb()
    .insert(articles)
    .values({
      title: `Title ${values.slug}`,
      excerpt: "Excerpt",
      body: bodyDoc(),
      publishedAt: status === "draft" ? null : new Date(),
      ...values,
      status,
    })
    .returning()
  return row!
}

// A complete, publishable draft (ArticleContent).
export const content = (
  refs: { categoryId: string; authorId: string; coverId: string },
  overrides: Record<string, unknown> = {}
) => ({
  title: "Calm is a skill",
  slug: "calm-test",
  excerpt: "Short excerpt.",
  cover: { mediaId: refs.coverId },
  categoryId: refs.categoryId,
  authorId: refs.authorId,
  featured: false,
  body: bodyDoc(),
  ...overrides,
})
