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
import * as z from "zod"

import { IconField } from "@/blocks/fields"
import { PageSeo, PageSettings } from "@/blocks/page"
import { BlockInstance } from "@/blocks/registry"
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

// A soft-deleted (or vanished) image drops the row that needs it instead of
// failing the whole page: the restrict FKs only stop hard deletes.
const need = (assets: Map<string, MediaAsset>, id: string) => {
  const asset = assets.get(id)
  if (!asset) console.warn(`[content] media ${id} is missing; row skipped`)
  return asset ?? null
}

// Documents are validated on write. A block that no longer parses (a
// hand-edited row, a schema change) is dropped with a warning so the rest of
// the page still renders; the page-level fields below still parse strictly.
const DocumentShape = z.object({ blocks: z.array(z.unknown()) })

function liveBlocks(path: string, document: unknown): BlockInstance[] {
  const shape = DocumentShape.safeParse(document)
  if (!shape.success) {
    console.warn(`[content] page ${path} has no block list; treated as missing`)
    return []
  }
  return shape.data.blocks.flatMap((raw, i) => {
    const block = BlockInstance.safeParse(raw)
    if (block.success) return [block.data]
    console.warn(
      `[content] page ${path} block ${i} is invalid; skipped`,
      z.prettifyError(block.error)
    )
    return []
  })
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
  if (!row) return null
  // Unpublishing keeps the last published JSON; status decides what is live.
  const document = draft
    ? row.draft
    : row.status === "published"
      ? row.published
      : null
  if (!document) return null
  const blocks = liveBlocks(row.path, document)
  if (blocks.length === 0) return null
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    systemKey: row.systemKey,
    document: { blocks },
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
  return rows.flatMap((r) => {
    const avatar = need(assets, r.avatarId)
    if (!avatar) return []
    const { id, quote, authorName: name, authorRole: role } = r
    return [{ id, quote, name, role, avatar }]
  })
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
  return rows.flatMap((r) => {
    const image = need(assets, r.imageId)
    if (!image) return []
    const { id, title, description, frame } = r
    return [{ id, title, description, image, frame }]
  })
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
  const image = need(await findMedia([r.imageId], db), r.imageId)
  if (!image) return null
  const { eyebrow, title, bullets, cta, tint } = r
  return { id: r.id, eyebrow, title, bullets, cta, image, tint }
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
): ArticleSummary | null {
  const image = r.a.coverId ? need(assets, r.a.coverId) : null
  const avatar = need(assets, r.author.avatarId)
  if (!image || !avatar) return null
  return {
    id: r.a.id,
    slug: r.a.slug,
    title: r.a.title,
    excerpt: r.a.excerpt,
    image,
    category: { slug: r.category.slug, name: r.category.name },
    author: { name: r.author.name, avatar },
    date: articleDate(r.a.publishedAt ?? r.a.createdAt),
    readingMinutes: r.a.readingMinutes,
    featured: r.a.featured,
  }
}

const mediaOf = (rows: ArticleRow[]) =>
  rows
    .flatMap((r) => [r.a.coverId, r.author.avatarId])
    .filter((id): id is string => id !== null)

// Published, newest first: the order the fixtures listed them in.
export async function listArticleSummaries(
  db = getDb()
): Promise<ArticleSummary[]> {
  const rows = await articleQuery(db)
    .where(eq(t.articles.status, "published"))
    .orderBy(desc(t.articles.publishedAt))
  const assets = await findMedia(mediaOf(rows), db)
  return rows.flatMap((r) => toSummary(r, assets) ?? [])
}

export async function findArticleBySlug(
  slug: string,
  db = getDb()
): Promise<ArticleDetail | null> {
  const [r] = await articleQuery(db)
    .where(and(eq(t.articles.slug, slug), eq(t.articles.status, "published")))
    .limit(1)
  if (!r) return null
  const summary = toSummary(r, await findMedia(mediaOf([r]), db))
  if (!summary) return null
  const [{ body }] = await db
    .select({ body: t.articles.body })
    .from(t.articles)
    .where(eq(t.articles.id, r.a.id))
  return { ...summary, body, topicSlug: r.topic }
}
