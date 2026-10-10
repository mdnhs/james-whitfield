import "server-only"

import { hasPermission } from "@/lib/auth/permissions"

import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import { isDeepStrictEqual } from "node:util"

import { collectMediaIds } from "@/blocks/media-refs"
import { PageSeo, type SeoPatch } from "@/blocks/page"
import { EMPTY_BODY, type ArticleDraft } from "@/lib/content/article"
import { slugify } from "@/lib/utils"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import {
  articleCategories,
  articles,
  authors,
  redirects,
} from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, REDIRECT_TAGS, tags } from "@/server/lib/cache"
import { conflictError, userName } from "@/server/lib/conflict"
import {
  deleteRevisions,
  findRevision,
  listRevisions,
} from "@/server/lib/revisions"
import {
  assertMediaExists,
  assertShareImage,
} from "@/server/modules/media/assert-media"
import { createRedirect } from "@/server/modules/redirects/service"

import {
  assertCanDelete,
  assertCanEdit,
  canPublish,
  isOwn,
  ownAuthorId,
} from "./access"
import { articlePath, parseContent, publishLocked } from "./publish"
import type { ArticleListQuery } from "./schema"

export type ArticleRow = typeof articles.$inferSelect

export const articleTags = (id: string, extra: string[] = []) => [
  tags.articles,
  tags.article(id),
  ...extra,
]

export async function findArticle(db: DbLike, id: string, lock = false) {
  const query = db.select().from(articles).where(eq(articles.id, id)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  if (!row) throw new ApiError("NOT_FOUND", "That article doesn't exist")
  return row
}

// Optimistic lock (docs/brief.md §6.5).
export async function writeIfVersion(
  db: DbLike,
  id: string,
  version: number,
  set: Partial<typeof articles.$inferInsert>
) {
  const [row] = await db
    .update(articles)
    .set({ ...set, version: sql`${articles.version} + 1` })
    .where(and(eq(articles.id, id), eq(articles.version, version)))
    .returning()
  if (row) return row
  throw await conflictError(db, await findArticle(db, id))
}

// The published copy in draft shape; Ruling R11: seeded rows have no draft.
export function publishedAsDraft(row: ArticleRow): ArticleDraft {
  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    cover: row.coverId ? { mediaId: row.coverId } : null,
    categoryId: row.categoryId,
    authorId: row.authorId,
    featured: row.featured,
    body: row.body,
  }
}
export const draftOf = (row: ArticleRow) =>
  (row.draft as ArticleDraft | null) ?? publishedAsDraft(row)

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`)
const tsQuery = (q: string) => sql`websearch_to_tsquery('english', ${q})`
// Ruling R7: the published copy's tsvector, or the working title.
const matches = (q: string) =>
  or(
    sql`${articles.search} @@ ${tsQuery(q)}`,
    ilike(sql`${articles.draft}->>'title'`, `%${escapeLike(q)}%`)
  )
const workingTitle = sql<string>`coalesce(${articles.draft}->>'title', ${articles.title})`
const workingSlug = sql<string>`coalesce(${articles.draft}->>'slug', ${articles.slug})`

export async function listArticles(query: ArticleListQuery) {
  const filters: (SQL | undefined)[] = [
    query.q ? matches(query.q) : undefined,
    query.status ? eq(articles.status, query.status) : undefined,
    query.categoryId ? eq(articles.categoryId, query.categoryId) : undefined,
    query.authorId ? eq(articles.authorId, query.authorId) : undefined,
    query.review ? isNotNull(articles.reviewRequestedAt) : undefined,
  ]
  const where = and(...filters)
  const db = getDb()
  const rows = await db
    .select({
      id: articles.id,
      title: workingTitle,
      slug: workingSlug,
      // What readers see now: the target of an unpublish redirect.
      liveSlug: articles.slug,
      status: articles.status,
      featured: articles.featured,
      category: articleCategories.name,
      author: authors.name,
      updatedAt: articles.updatedAt,
      publishedAt: articles.publishedAt,
      scheduledFor: articles.scheduledFor,
      reviewRequestedAt: articles.reviewRequestedAt,
    })
    .from(articles)
    .innerJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .innerJoin(authors, eq(articles.authorId, authors.id))
    .where(where)
    .orderBy(
      ...(query.q
        ? [desc(sql`ts_rank(${articles.search}, ${tsQuery(query.q)})`)]
        : []),
      desc(articles.updatedAt)
    )
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
  const [{ total }] = await db
    .select({ total: count() })
    .from(articles)
    .where(where)
  return { items: rows, page: query.page, pageSize: query.pageSize, total }
}

export async function getArticle(actor: Actor, id: string) {
  const db = getDb()
  const row = await findArticle(db, id)
  const draft = draftOf(row)
  return {
    id: row.id,
    status: row.status,
    slug: row.slug,
    draft,
    seo: PageSeo.parse(row.seo),
    version: row.version,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    scheduledFor: row.scheduledFor,
    reviewRequestedAt: row.reviewRequestedAt,
    updatedBy: await userName(db, row.updatedBy),
    // isDeepStrictEqual ignores key order (jsonb reorders keys).
    hasUnpublishedChanges:
      row.status === "published" &&
      !isDeepStrictEqual(draft, publishedAsDraft(row)),
    canEdit: canPublish(actor) || (await isOwn(db, actor, row, draft.authorId)),
  }
}

async function uniqueSlug(db: DbLike, title: string) {
  const base = slugify(title).slice(0, 70) || "article"
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const [taken] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(
        or(eq(articles.slug, slug), sql`${articles.draft}->>'slug' = ${slug}`)
      )
      .limit(1)
    if (!taken) return slug
  }
}

async function assertExists(db: DbLike, categoryId: string, authorId: string) {
  const [cat] = await db
    .select({ id: articleCategories.id })
    .from(articleCategories)
    .where(eq(articleCategories.id, categoryId))
  const [author] = await db
    .select({ id: authors.id })
    .from(authors)
    .where(eq(authors.id, authorId))
  if (!cat)
    throw new ApiError("VALIDATION_FAILED", "Choose a category", {
      categoryId: ["That category doesn't exist"],
    })
  if (!author)
    throw new ApiError("VALIDATION_FAILED", "Choose an author", {
      authorId: ["That author doesn't exist"],
    })
}

export async function createArticle(
  actor: Actor,
  input: { title: string; categoryId: string; authorId?: string }
) {
  return getDb().transaction(async (tx) => {
    const own = await ownAuthorId(tx, actor)
    const authorId = input.authorId ?? own
    if (authorId !== own && !canPublish(actor))
      throw new ApiError("FORBIDDEN", "You can't credit another author")
    await assertExists(tx, input.categoryId, authorId)
    const slug = await uniqueSlug(tx, input.title)
    const draft: ArticleDraft = {
      title: input.title,
      slug,
      excerpt: "",
      cover: null,
      categoryId: input.categoryId,
      authorId,
      featured: false,
      body: EMPTY_BODY,
    }
    // The typed columns hold the published copy; until the first publish they
    // only reserve the slug (status draft is never served).
    const [row] = await tx
      .insert(articles)
      .values({
        slug,
        title: input.title,
        excerpt: "",
        categoryId: input.categoryId,
        authorId,
        body: EMPTY_BODY,
        draft,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning()
    await audit(
      actor,
      {
        action: "article.create",
        entityType: "article",
        entityId: row!.id,
        summary: `Created article “${input.title}”`,
      },
      tx
    )
    return { id: row!.id, version: row!.version }
  })
}

// A non-publisher's edit to a scheduled article would otherwise go live at
// the tick unreviewed: the write also unschedules it and asks for review.
function editedWhileScheduled(actor: Actor, row: ArticleRow) {
  return !canPublish(actor) && row.status === "scheduled"
}
const UNSCHEDULED_SET = {
  status: "draft",
  scheduledFor: null,
  scheduledBy: null,
} as const
async function auditUnscheduled(
  actor: Actor,
  tx: DbLike,
  row: ArticleRow,
  title: string
) {
  await audit(
    actor,
    {
      action: "article.unscheduled",
      entityType: "article",
      entityId: row.id,
      summary: `Unscheduled “${title}”: edited by author`,
      diff: { reason: { from: null, to: "edited_by_author" } },
    },
    tx
  )
}

// Autosave (~1.2 s): not audited, like pages.
export async function saveArticleDraft(
  actor: Actor,
  id: string,
  input: { version: number; draft: ArticleDraft }
) {
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    const current = draftOf(row)
    await assertCanEdit(tx, actor, row, current.authorId)
    if (
      !canPublish(actor) &&
      input.draft.authorId !== current.authorId &&
      input.draft.authorId !== (await ownAuthorId(tx, actor))
    ) {
      throw new ApiError("FORBIDDEN", "You can't credit another author")
    }
    if (row.version !== input.version) throw await conflictError(tx, row)
    const unschedule = editedWhileScheduled(actor, row)
    const saved = await writeIfVersion(tx, id, input.version, {
      draft: input.draft,
      updatedBy: actor.userId,
      ...(unschedule
        ? {
            ...UNSCHEDULED_SET,
            reviewRequestedAt: new Date(),
            reviewRequestedBy: actor.userId,
          }
        : {}),
    })
    if (unschedule) await auditUnscheduled(actor, tx, row, current.title)
    return {
      version: saved.version,
      updatedAt: saved.updatedAt,
      status: saved.status,
      scheduledFor: saved.scheduledFor,
      reviewRequestedAt: saved.reviewRequestedAt,
    }
  })
}

// Live on save, no version bump (docs/brief.md §6.5), like pages.
export async function updateArticleSeo(
  actor: Actor,
  id: string,
  patch: Record<string, unknown>
) {
  if (!hasPermission(actor.roles, { seo: ["update"] }))
    throw new ApiError("FORBIDDEN", "You can't change SEO settings")
  const saved = await getDb().transaction(async (tx) => {
    const before = await findArticle(tx, id, true)
    await assertMediaExists(tx, collectMediaIds(patch))
    await assertShareImage(tx, (patch as SeoPatch).ogImage)
    const [row] = await tx
      .update(articles)
      .set({
        seo: sql`${articles.seo} || ${JSON.stringify(patch)}::jsonb`,
        updatedBy: actor.userId,
      })
      .where(eq(articles.id, id))
      .returning()
    const diff = Object.fromEntries(
      Object.entries(patch).map(([k, to]) => [
        `seo.${k}`,
        { from: (before.seo as Record<string, unknown>)[k] ?? null, to },
      ])
    )
    await audit(
      actor,
      {
        action: "article.seo",
        entityType: "article",
        entityId: id,
        summary: `Updated SEO of “${before.title}”`,
        diff,
      },
      tx
    )
    return row!
  })
  if (saved.status === "published") invalidate(articleTags(id))
  return { seo: PageSeo.parse(saved.seo) }
}

export async function submitForReview(actor: Actor, id: string) {
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    await assertCanEdit(tx, actor, row, draftOf(row).authorId)
    const [saved] = await tx
      .update(articles)
      .set({ reviewRequestedAt: new Date(), reviewRequestedBy: actor.userId })
      .where(eq(articles.id, id))
      .returning()
    await audit(
      actor,
      {
        action: "article.submit",
        entityType: "article",
        entityId: id,
        summary: `Submitted “${draftOf(row).title}” for review`,
      },
      tx
    )
    return { reviewRequestedAt: saved!.reviewRequestedAt }
  })
}

export async function deleteArticle(actor: Actor, id: string) {
  const { row, redirectsChanged } = await getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    await assertCanEdit(tx, actor, row, draftOf(row).authorId)
    assertCanDelete(actor, row)
    await deleteRevisions(tx, "article", id)
    // Redirects into or out of a deleted article would 301 to a 404.
    const gone = await tx
      .delete(redirects)
      .where(
        or(
          eq(redirects.articleId, id),
          eq(redirects.destination, articlePath(row.slug))
        )
      )
      .returning({ id: redirects.id })
    await tx.delete(articles).where(eq(articles.id, id))
    await audit(
      actor,
      {
        action: "article.delete",
        entityType: "article",
        entityId: id,
        summary: `Deleted article “${draftOf(row).title}”`,
      },
      tx
    )
    return { row, redirectsChanged: gone.length > 0 }
  })
  if (row.status === "published" || redirectsChanged)
    invalidate(articleTags(id, redirectsChanged ? [...REDIRECT_TAGS] : []))
  return { ok: true as const }
}

export async function searchArticleHits(q: string, limit = 5) {
  const term = q.trim()
  if (term.length < 2) return []
  const rows = await getDb()
    .select({ id: articles.id, title: workingTitle })
    .from(articles)
    .where(matches(term))
    .orderBy(
      desc(sql`ts_rank(${articles.search}, ${tsQuery(term)})`),
      desc(articles.updatedAt)
    )
    .limit(limit)
  return rows.map((r) => ({
    id: `article:${r.id}`,
    kind: "article" as const,
    label: r.title,
    href: `/admin/insights/${r.id}`,
  }))
}
export async function publishArticle(
  actor: Actor,
  id: string,
  version: number
) {
  const { row, redirectsChanged } = await getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    if (row.version !== version) throw await conflictError(tx, row)
    return publishLocked(tx, row, actor)
  })
  invalidate(articleTags(id, redirectsChanged ? [...REDIRECT_TAGS] : []))
  return { version: row.version, publishedAt: row.publishedAt, slug: row.slug }
}

export async function scheduleArticle(
  actor: Actor,
  id: string,
  input: { version: number; at: string }
) {
  const at = new Date(input.at)
  if (at.getTime() <= Date.now() + 30_000) {
    throw new ApiError("VALIDATION_FAILED", "Pick a time in the future", {
      at: ["Pick a time at least 30 seconds ahead"],
    })
  }
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    if (row.version !== input.version) throw await conflictError(tx, row)
    if (row.status !== "draft" && row.status !== "archived") {
      throw new ApiError(
        "BAD_REQUEST",
        "This article is live or already scheduled. Publish the changes instead."
      )
    }
    // Validate now so the tick rarely meets a broken draft (Ruling R5).
    const content = parseContent(row.draft ?? null)
    const saved = await writeIfVersion(tx, id, input.version, {
      status: "scheduled",
      scheduledFor: at,
      scheduledBy: actor.userId,
      updatedBy: actor.userId,
    })
    await audit(
      actor,
      {
        action: "article.schedule",
        entityType: "article",
        entityId: id,
        summary: `Scheduled “${content.title}” for ${at.toISOString()}`,
      },
      tx
    )
    return { version: saved.version, scheduledFor: saved.scheduledFor }
  })
}

export async function unpublishArticle(
  actor: Actor,
  id: string,
  input: { version: number; archive: boolean; redirectTo: string | null }
) {
  const result = await getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    if (row.version !== input.version) throw await conflictError(tx, row)
    const wasLive = row.status === "published"
    if (!wasLive && row.status !== "scheduled")
      throw new ApiError(
        "BAD_REQUEST",
        "This article isn't published or scheduled"
      )
    const status = input.archive ? ("archived" as const) : ("draft" as const)
    let redirected = false
    if (wasLive && input.redirectTo) {
      const from = articlePath(row.slug)
      if (input.redirectTo === from)
        throw new ApiError("VALIDATION_FAILED", "Choose another page", {
          redirectTo: ["That is this article"],
        })
      if (input.redirectTo !== "/insights") {
        const [target] = await tx
          .select({ id: articles.id })
          .from(articles)
          .where(
            and(
              eq(articles.slug, input.redirectTo.slice("/insights/".length)),
              eq(articles.status, "published")
            )
          )
        if (!target)
          throw new ApiError(
            "VALIDATION_FAILED",
            "Choose a published article",
            { redirectTo: ["That article isn't live"] }
          )
      }
      await createRedirect(tx, {
        from,
        to: input.redirectTo,
        articleId: id,
        note: "Automatic: the article was unpublished",
        createdBy: actor.userId,
      })
      redirected = true
    }
    const saved = await writeIfVersion(tx, id, input.version, {
      status,
      scheduledFor: null,
      scheduledBy: null,
      updatedBy: actor.userId,
    })
    await audit(
      actor,
      {
        action: input.archive ? "article.archive" : "article.unpublish",
        entityType: "article",
        entityId: id,
        summary: `${input.archive ? "Archived" : "Unpublished"} “${row.title}”`,
      },
      tx
    )
    return { version: saved.version, status, wasLive, redirected }
  })
  if (result.wasLive)
    invalidate(articleTags(id, result.redirected ? [...REDIRECT_TAGS] : []))
  return { version: result.version, status: result.status }
}

export const articleRevisions = (id: string) =>
  listRevisions(getDb(), "article", id)

export async function restoreArticleRevision(
  actor: Actor,
  id: string,
  revisionId: string,
  version: number
) {
  return getDb().transaction(async (tx) => {
    const row = await findArticle(tx, id, true)
    await assertCanEdit(tx, actor, row, draftOf(row).authorId)
    const revision = await findRevision(tx, "article", id, revisionId)
    if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
    const unschedule = editedWhileScheduled(actor, row)
    const saved = await writeIfVersion(tx, id, version, {
      draft: revision.snapshot as ArticleDraft,
      updatedBy: actor.userId,
      ...(unschedule
        ? {
            ...UNSCHEDULED_SET,
            reviewRequestedAt: new Date(),
            reviewRequestedBy: actor.userId,
          }
        : {}),
    })
    if (unschedule) await auditUnscheduled(actor, tx, row, draftOf(row).title)
    await audit(
      actor,
      {
        action: "article.restore",
        entityType: "article",
        entityId: id,
        summary: `Loaded version ${revision.version} of “${row.title}” into the draft`,
      },
      tx
    )
    return {
      version: saved.version,
      status: saved.status,
      scheduledFor: saved.scheduledFor,
      reviewRequestedAt: saved.reviewRequestedAt,
    }
  })
}
