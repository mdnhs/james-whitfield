import "server-only"

import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
} from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import { IconField } from "@/blocks/fields"
import { PageDocument, PageSeo, PageSettings } from "@/blocks/page"
import type {
  ArticleDetail,
  ArticleSummary,
  CategoryView,
  CtaBandView,
  FaqView,
  PlanView,
  ProcessStepView,
  PublishedPage,
  ServiceView,
  TestimonialView,
} from "@/lib/content/types"
import { articleDate } from "@/lib/format-date"
import type { MediaAsset } from "@/lib/media"
import { getDb } from "@/server/db/client"
import * as t from "@/server/db/schema"

type MediaRow = typeof t.media.$inferSelect

export const toMediaAsset = (r: MediaRow): MediaAsset => ({
  id: r.id,
  src: r.url,
  width: r.width ?? 0,
  height: r.height ?? 0,
  blurDataURL: r.blurDataUrl,
  alt: r.isDecorative ? "" : r.alt,
  focal: { x: r.focalX, y: r.focalY },
})

export async function findMedia(ids: string[], db = getDb()) {
  if (ids.length === 0) return new Map<string, MediaAsset>()
  const rows = await db
    .select()
    .from(t.media)
    .where(and(inArray(t.media.id, ids), isNull(t.media.deletedAt)))
  return new Map(rows.map((r) => [r.id, toMediaAsset(r)]))
}

const need = (assets: Map<string, MediaAsset>, id: string) => {
  const asset = assets.get(id)
  if (!asset) throw new Error(`Media ${id} is missing`)
  return asset
}

export async function findPageByPath(
  path: string,
  { draft }: { draft: boolean },
  db = getDb()
): Promise<PublishedPage | null> {
  const [row] = await db
    .select()
    .from(t.pages)
    .where(eq(t.pages.path, path))
    .limit(1)
  const document = draft ? row?.draft : row?.published
  if (!row || !document) return null
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    systemKey: row.systemKey,
    // Validated on write; parsing again turns a hand-edited row into a clear
    // error instead of a broken render.
    document: PageDocument.parse(document),
    seo: PageSeo.parse(row.seo),
    settings: PageSettings.parse(row.settings),
  }
}

export async function findSetting(key: string, db = getDb()) {
  const [row] = await db
    .select()
    .from(t.settings)
    .where(eq(t.settings.key, key))
    .limit(1)
  return row ?? null
}

const visible = (table: { isVisible: AnyPgColumn }) => eq(table.isVisible, true)

export async function listServices(db = getDb()): Promise<ServiceView[]> {
  const rows = await db
    .select()
    .from(t.services)
    .where(visible(t.services))
    .orderBy(asc(t.services.sort))
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    body: r.body,
    icon: IconField.parse(r.icon),
  }))
}

export async function listPlans(db = getDb()): Promise<PlanView[]> {
  const rows = await db
    .select()
    .from(t.plans)
    .where(visible(t.plans))
    .orderBy(asc(t.plans.sort))
  return rows.map(
    ({
      id,
      slug,
      name,
      priceLabel,
      unit,
      summary,
      features,
      ctaLabel,
      featured,
    }) => ({
      id,
      slug,
      name,
      priceLabel,
      unit,
      summary,
      features,
      ctaLabel,
      featured,
    })
  )
}

export async function listTestimonials(
  db = getDb()
): Promise<TestimonialView[]> {
  const rows = await db
    .select()
    .from(t.testimonials)
    .where(visible(t.testimonials))
    .orderBy(asc(t.testimonials.sort))
  const assets = await findMedia(
    rows.map((r) => r.avatarId),
    db
  )
  return rows.map((r) => ({
    id: r.id,
    quote: r.quote,
    name: r.authorName,
    role: r.authorRole,
    avatar: need(assets, r.avatarId),
  }))
}

export async function listFaqs(db = getDb()): Promise<FaqView[]> {
  const rows = await db
    .select()
    .from(t.faqs)
    .where(visible(t.faqs))
    .orderBy(asc(t.faqs.sort))
  return rows.map(({ id, question, answer }) => ({ id, question, answer }))
}

export async function listProcessSteps(
  db = getDb()
): Promise<ProcessStepView[]> {
  const rows = await db
    .select()
    .from(t.processSteps)
    .where(visible(t.processSteps))
    .orderBy(asc(t.processSteps.sort))
  const assets = await findMedia(
    rows.map((r) => r.imageId),
    db
  )
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    image: need(assets, r.imageId),
    frame: r.frame,
  }))
}

export async function findCtaBand(
  id: string,
  db = getDb()
): Promise<CtaBandView | null> {
  const [r] = await db
    .select()
    .from(t.ctaBands)
    .where(and(eq(t.ctaBands.id, id), visible(t.ctaBands)))
    .limit(1)
  if (!r) return null
  const assets = await findMedia([r.imageId], db)
  return {
    id: r.id,
    eyebrow: r.eyebrow,
    title: r.title,
    bullets: r.bullets,
    cta: r.cta,
    image: need(assets, r.imageId),
    tint: r.tint,
  }
}

export async function listCategories(db = getDb()): Promise<CategoryView[]> {
  const rows = await db
    .select()
    .from(t.articleCategories)
    .where(visible(t.articleCategories))
    .orderBy(asc(t.articleCategories.sort))
  return rows.map(({ id, slug, name }) => ({ id, slug, name }))
}

// Summaries never carry bodies: they feed client components (§4.7).
/* eslint-disable @typescript-eslint/no-unused-vars -- discarded by rest */
const {
  body: _body,
  draft: _draft,
  search: _search,
  ...summaryColumns
} = getTableColumns(t.articles)
/* eslint-enable @typescript-eslint/no-unused-vars */

function articleQuery(db: ReturnType<typeof getDb>) {
  return db
    .select({
      a: summaryColumns,
      category: t.articleCategories,
      author: t.authors,
      topic: t.services.slug,
    })
    .from(t.articles)
    .innerJoin(
      t.articleCategories,
      eq(t.articles.categoryId, t.articleCategories.id)
    )
    .innerJoin(t.authors, eq(t.articles.authorId, t.authors.id))
    .leftJoin(
      t.services,
      eq(t.articleCategories.relatedServiceId, t.services.id)
    )
}

type ArticleRow = Awaited<
  ReturnType<ReturnType<typeof articleQuery>["execute"]>
>[number]

function toSummary(
  r: ArticleRow,
  assets: Map<string, MediaAsset>
): ArticleSummary {
  return {
    id: r.a.id,
    slug: r.a.slug,
    title: r.a.title,
    excerpt: r.a.excerpt,
    image: need(assets, r.a.coverId),
    category: { slug: r.category.slug, name: r.category.name },
    author: { name: r.author.name, avatar: need(assets, r.author.avatarId) },
    date: articleDate(r.a.publishedAt ?? r.a.createdAt),
    readingMinutes: r.a.readingMinutes,
    featured: r.a.featured,
  }
}

const mediaOf = (rows: ArticleRow[]) =>
  rows.flatMap((r) => [r.a.coverId, r.author.avatarId])

// Published, newest first: the order the fixtures listed them in.
export async function listArticleSummaries(
  db = getDb()
): Promise<ArticleSummary[]> {
  const rows = await articleQuery(db)
    .where(eq(t.articles.status, "published"))
    .orderBy(desc(t.articles.publishedAt))
  const assets = await findMedia(mediaOf(rows), db)
  return rows.map((r) => toSummary(r, assets))
}

export async function findArticleBySlug(
  slug: string,
  db = getDb()
): Promise<ArticleDetail | null> {
  const [r] = await articleQuery(db)
    .where(and(eq(t.articles.slug, slug), eq(t.articles.status, "published")))
    .limit(1)
  if (!r) return null
  const [{ body }] = await db
    .select({ body: t.articles.body })
    .from(t.articles)
    .where(eq(t.articles.id, r.a.id))
  const assets = await findMedia(mediaOf([r]), db)
  return { ...toSummary(r, assets), body, topicSlug: r.topic }
}
