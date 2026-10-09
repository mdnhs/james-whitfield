import "server-only"

import { eq, or, sql, type AnyColumn } from "drizzle-orm"

import type { DbLike } from "@/server/db/client"
import * as t from "@/server/db/schema"

export type MediaUse = {
  kind: "page" | "setting" | "collection" | "author" | "article"
  id: string
  label: string
}

// Every table mediaUsage reads. deleteMedia locks them for the check.
export const MEDIA_REFERRERS = sql`pages, settings, testimonials, process_steps, cta_bands, authors, articles`

// docs/brief.md §14: usage is found by scanning documents for the id (JSON
// documents) and the image foreign keys. It feeds the drawer and the delete
// guard. Sequential, not Promise.all: inside a transaction every query shares
// one connection anyway. `id` is a validated uuid, so it carries no LIKE
// wildcards.
export async function mediaUsage(db: DbLike, id: string): Promise<MediaUse[]> {
  const like = `%${id}%`
  const text = (column: AnyColumn) => sql`${column}::text like ${like}`
  const pageRows = await db
    .select({ id: t.pages.id, label: t.pages.title })
    .from(t.pages)
    .where(or(text(t.pages.draft), text(t.pages.published), text(t.pages.seo)))
  const settingRows = await db
    .select({ id: t.settings.key, label: t.settings.key })
    .from(t.settings)
    .where(or(text(t.settings.value), text(t.settings.draft)))
  const testimonialRows = await db
    .select({ id: t.testimonials.id, label: t.testimonials.authorName })
    .from(t.testimonials)
    .where(eq(t.testimonials.avatarId, id))
  const stepRows = await db
    .select({ id: t.processSteps.id, label: t.processSteps.title })
    .from(t.processSteps)
    .where(eq(t.processSteps.imageId, id))
  const bandRows = await db
    .select({ id: t.ctaBands.id, label: t.ctaBands.name })
    .from(t.ctaBands)
    .where(eq(t.ctaBands.imageId, id))
  const authorRows = await db
    .select({ id: t.authors.id, label: t.authors.name })
    .from(t.authors)
    .where(eq(t.authors.avatarId, id))
  const articleRows = await db
    .select({ id: t.articles.id, label: t.articles.title })
    .from(t.articles)
    .where(
      or(
        eq(t.articles.coverId, id),
        text(t.articles.body),
        text(t.articles.draft),
        text(t.articles.seo)
      )
    )
  return [
    ...pageRows.map((r) => ({ kind: "page" as const, ...r })),
    ...settingRows.map((r) => ({ kind: "setting" as const, ...r })),
    ...[...testimonialRows, ...stepRows, ...bandRows].map((r) => ({
      kind: "collection" as const,
      ...r,
    })),
    ...authorRows.map((r) => ({ kind: "author" as const, ...r })),
    ...articleRows.map((r) => ({ kind: "article" as const, ...r })),
  ]
}
