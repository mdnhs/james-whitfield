import "server-only"

import { and, eq, ne, sql } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import { ArticleContent } from "@/lib/content/article"
import { plainText, readingMinutes } from "@/lib/content/reading-time"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import type { Tx } from "@/server/db/client"
import { articleCategories, articles, authors } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { isUniqueViolation } from "@/server/lib/conflict"
import { writeRevision } from "@/server/lib/revisions"
import { assertMediaExists } from "@/server/modules/media/assert-media"
import {
  recordPathChange,
  releasePath,
} from "@/server/modules/redirects/service"

import type { ArticleRow } from "./service"

export const articlePath = (slug: string) => `/insights/${slug}`
const slugTaken = () =>
  new ApiError("CONFLICT", "Another article already uses that slug", {
    slug: ["Already used"],
  })

export function parseContent(draft: unknown) {
  const parsed = ArticleContent.safeParse(draft)
  if (!parsed.success)
    throw invalid(parsed.error, "Fix the highlighted fields before publishing")
  return parsed.data
}

async function assertRefs(tx: Tx, c: ArticleContent, id: string) {
  await assertMediaExists(tx, collectMediaIds({ cover: c.cover, body: c.body }))
  const [cat] = await tx
    .select({ id: articleCategories.id })
    .from(articleCategories)
    .where(eq(articleCategories.id, c.categoryId))
  const [author] = await tx
    .select({ id: authors.id })
    .from(authors)
    .where(eq(authors.id, c.authorId))
  const fieldErrors: Record<string, string[]> = {}
  if (!cat) fieldErrors.categoryId = ["That category no longer exists"]
  if (!author) fieldErrors.authorId = ["That author no longer exists"]
  if (Object.keys(fieldErrors).length)
    throw new ApiError(
      "VALIDATION_FAILED",
      "Fix the highlighted fields before publishing",
      fieldErrors
    )
  const [holder] = await tx
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.slug, c.slug), ne(articles.id, id)))
  if (holder) throw slugTaken()
}

// The one publish path: the API (actor) and the scheduler (null). Runs in
// the caller's transaction on a row it has locked; the caller invalidates.
export async function publishLocked(
  tx: Tx,
  row: ArticleRow,
  actor: Actor | null
) {
  const content = parseContent(row.draft ?? null)
  await assertRefs(tx, content, row.id)
  const by = actor?.userId ?? row.scheduledBy
  // Only a slug readers have seen needs a redirect.
  const slugChanged = row.publishedAt !== null && row.slug !== content.slug
  if (content.featured) {
    await tx
      .update(articles)
      .set({ featured: false })
      .where(and(eq(articles.featured, true), ne(articles.id, row.id)))
  }
  const text = plainText(content.body)
  let next: ArticleRow | undefined
  try {
    ;[next] = await tx
      .update(articles)
      .set({
        slug: content.slug,
        title: content.title,
        excerpt: content.excerpt,
        coverId: content.cover.mediaId,
        categoryId: content.categoryId,
        authorId: content.authorId,
        featured: content.featured,
        body: content.body,
        bodyText: text,
        readingMinutes: readingMinutes(text),
        draft: content,
        status: "published",
        publishedAt: row.publishedAt ?? new Date(),
        scheduledFor: null,
        scheduledBy: null,
        reviewRequestedAt: null,
        reviewRequestedBy: null,
        updatedBy: by,
        version: sql`${articles.version} + 1`,
      })
      .where(eq(articles.id, row.id))
      .returning()
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
  const released = await releasePath(tx, articlePath(content.slug))
  if (slugChanged) {
    await recordPathChange(tx, {
      articleId: row.id,
      from: articlePath(row.slug),
      to: articlePath(content.slug),
      note: "Automatic: the article's slug changed",
      createdBy: by ?? null,
    })
  }
  await writeRevision(tx, {
    entityType: "article",
    entityId: row.id,
    version: next!.version,
    snapshot: content,
    createdBy: by ?? null,
  })
  await audit(
    actor,
    {
      action: "article.publish",
      entityType: "article",
      entityId: row.id,
      summary: actor
        ? `Published “${content.title}”`
        : `Published “${content.title}” on schedule`,
      diff: slugChanged ? { slug: { from: row.slug, to: content.slug } } : null,
    },
    tx
  )
  return { row: next!, slugChanged, redirectsChanged: released || slugChanged }
}
