import "server-only"

import { and, desc, eq, max } from "drizzle-orm"

import { PageSeo, type PageDocument } from "@/blocks/page"
import type { ArticleBodyDoc } from "@/blocks/rich-text"
import { categoryHref } from "@/lib/content/category-href"
import { getDb, type DbLike } from "@/server/db/client"
import { articleCategories, articles, pages } from "@/server/db/schema"
import { notHiddenServicePage } from "@/server/modules/service-pages/visible"

export type LiveEntity = {
  kind: "page" | "article"
  id: string
  path: string
  home: boolean
  systemKey: string | null
  title: string
  summary: string | null
  seo: PageSeo
  updatedAt: Date
  document: PageDocument | null
  body: ArticleBodyDoc | null
  coverId: string | null
}

// Everything a visitor can reach (Ruling R11): published pages and articles.
export async function listLiveEntities(
  db: DbLike = getDb()
): Promise<LiveEntity[]> {
  const [pageRows, articleRows] = await Promise.all([
    db
      .select({
        id: pages.id,
        path: pages.path,
        title: pages.title,
        systemKey: pages.systemKey,
        seo: pages.seo,
        published: pages.published,
        updatedAt: pages.updatedAt,
        publishedAt: pages.publishedAt,
      })
      .from(pages)
      .where(and(eq(pages.status, "published"), notHiddenServicePage)),
    db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        excerpt: articles.excerpt,
        coverId: articles.coverId,
        seo: articles.seo,
        body: articles.body,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt)),
  ])
  return [
    ...pageRows.map((p) => ({
      kind: "page" as const,
      id: p.id,
      path: p.path,
      home: p.systemKey === "home",
      systemKey: p.systemKey,
      title: p.title,
      summary: null,
      seo: PageSeo.parse(p.seo),
      updatedAt: p.publishedAt ?? p.updatedAt,
      document: p.published as PageDocument | null,
      body: null,
      coverId: null,
    })),
    ...articleRows.map((a) => ({
      kind: "article" as const,
      id: a.id,
      path: `/insights/${a.slug}`,
      home: false,
      systemKey: null,
      title: a.title,
      summary: a.excerpt,
      seo: PageSeo.parse(a.seo),
      updatedAt: a.updatedAt,
      document: null,
      body: a.body as ArticleBodyDoc,
      coverId: a.coverId,
    })),
  ]
}

// Ruling R16: noindex and canonical-elsewhere entities stay out of the sitemap.
export const isIndexable = (e: LiveEntity) =>
  !e.seo.noindex && (e.seo.canonical === null || e.seo.canonical === e.path)

// Visible categories with at least one published article: their hub pages are
// reachable and worth indexing; an empty hub stays out of the sitemap.
export async function listCategoryHubs(db: DbLike = getDb()) {
  const rows = await db
    .select({
      slug: articleCategories.slug,
      name: articleCategories.name,
      description: articleCategories.description,
      seoTitle: articleCategories.seoTitle,
      seoDescription: articleCategories.seoDescription,
      updatedAt: max(articles.updatedAt),
    })
    .from(articleCategories)
    .innerJoin(articles, eq(articles.categoryId, articleCategories.id))
    .where(
      and(
        eq(articles.status, "published"),
        eq(articleCategories.isVisible, true)
      )
    )
    .groupBy(articleCategories.id)
  return rows.map((r) => ({
    path: categoryHref(r.slug),
    title: r.seoTitle || r.name,
    description: r.seoDescription || r.description,
    updatedAt: r.updatedAt ?? new Date(0),
  }))
}
