import "server-only"

import { count, desc, eq, ilike, or } from "drizzle-orm"

import type { RedirectInput, RedirectPatch } from "@/lib/seo/redirect-rules"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { articles, pages, redirects } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, REDIRECT_TAGS } from "@/server/lib/cache"
import { createRedirect } from "@/server/modules/redirects/service"

export const LIVE_SOURCE_WARNING =
  "A live page is at this address, so the redirect waits until that page is unpublished or moved."

async function livePaths(db: DbLike) {
  const [p, a] = await Promise.all([
    db
      .select({ path: pages.path })
      .from(pages)
      .where(eq(pages.status, "published")),
    db
      .select({ slug: articles.slug })
      .from(articles)
      .where(eq(articles.status, "published")),
  ])
  return new Set([
    ...p.map((r) => r.path),
    ...a.map((r) => `/insights/${r.slug}`),
  ])
}

type Row = typeof redirects.$inferSelect
const present = (r: Row, live: Set<string>) => ({
  id: r.id,
  sourcePath: r.sourcePath,
  destination: r.destination,
  statusCode: r.statusCode,
  isActive: r.isActive,
  hitCount: r.hitCount,
  lastHitAt: r.lastHitAt,
  note: r.note,
  automatic: r.articleId !== null || r.pageId !== null,
  shadowed: live.has(r.sourcePath),
  updatedAt: r.updatedAt,
})

// `%` and `_` in the search box are literal characters, not wildcards.
const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`

export async function listRedirects(q: {
  q?: string
  page: number
  pageSize: number
}) {
  const db = getDb()
  const where = q.q
    ? or(
        ilike(redirects.sourcePath, like(q.q)),
        ilike(redirects.destination, like(q.q))
      )
    : undefined
  const [rows, [totals], live] = await Promise.all([
    db
      .select()
      .from(redirects)
      .where(where)
      .orderBy(desc(redirects.updatedAt), desc(redirects.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ total: count() }).from(redirects).where(where),
    livePaths(db),
  ])
  return {
    items: rows.map((r) => present(r, live)),
    page: q.page,
    pageSize: q.pageSize,
    total: totals?.total ?? 0,
  }
}

async function findRow(db: DbLike, id: string) {
  const [row] = await db
    .select()
    .from(redirects)
    .where(eq(redirects.id, id))
    .limit(1)
  if (!row) throw new ApiError("NOT_FOUND", "Redirect not found")
  return row
}

async function written(db: DbLike, sourcePath: string) {
  const [row] = await db
    .select()
    .from(redirects)
    .where(eq(redirects.sourcePath, sourcePath))
  if (!row)
    throw new ApiError(
      "VALIDATION_FAILED",
      "A redirect can't point at itself",
      {
        destination: ["A redirect can't point at itself"],
      }
    )
  const live = await livePaths(db)
  return {
    row,
    redirect: present(row, live),
    warning: live.has(row.sourcePath) ? LIVE_SOURCE_WARNING : null,
  }
}

export async function createManualRedirect(actor: Actor, input: RedirectInput) {
  const result = await getDb().transaction(async (tx) => {
    const [taken] = await tx
      .select({ id: redirects.id })
      .from(redirects)
      .where(eq(redirects.sourcePath, input.sourcePath))
    if (taken)
      throw new ApiError(
        "CONFLICT",
        "A redirect from that address already exists",
        { sourcePath: ["A redirect from that address already exists"] }
      )
    await createRedirect(tx, {
      from: input.sourcePath,
      to: input.destination,
      statusCode: input.statusCode,
      note: input.note,
      createdBy: actor.userId,
    })
    const { row, redirect, warning } = await written(tx, input.sourcePath)
    await audit(
      actor,
      {
        action: "redirect.create",
        entityType: "redirect",
        entityId: row.id,
        summary: `Redirect ${row.sourcePath} → ${row.destination}`,
      },
      tx
    )
    return { redirect, warning }
  })
  invalidate(REDIRECT_TAGS)
  return result
}

export async function updateRedirect(
  actor: Actor,
  id: string,
  patch: RedirectPatch
) {
  const result = await getDb().transaction(async (tx) => {
    const before = await findRow(tx, id)
    // A new destination, or switching a row back on, goes through the
    // flattening writer so it can neither chain nor loop (Ruling R5).
    const reactivated = patch.isActive === true && !before.isActive
    if (patch.destination !== undefined || reactivated) {
      await createRedirect(tx, {
        from: before.sourcePath,
        to: patch.destination ?? before.destination,
        statusCode: patch.statusCode ?? before.statusCode,
        articleId: before.articleId,
        pageId: before.pageId,
        note: patch.note ?? before.note,
        createdBy: before.createdBy,
      })
    }
    await tx
      .update(redirects)
      .set({
        statusCode: patch.statusCode ?? before.statusCode,
        isActive: patch.isActive ?? before.isActive,
        note: patch.note ?? before.note,
      })
      .where(eq(redirects.sourcePath, before.sourcePath))
    const { row, redirect, warning } = await written(tx, before.sourcePath)
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of [
      "destination",
      "statusCode",
      "isActive",
      "note",
    ] as const) {
      if (before[key] !== row[key])
        diff[key] = { from: before[key], to: row[key] }
    }
    await audit(
      actor,
      {
        action: "redirect.update",
        entityType: "redirect",
        entityId: row.id,
        summary: `Updated redirect ${row.sourcePath} → ${row.destination}`,
        diff,
      },
      tx
    )
    return { redirect, warning }
  })
  invalidate(REDIRECT_TAGS)
  return result
}

export async function deleteRedirect(actor: Actor, id: string) {
  await getDb().transaction(async (tx) => {
    const row = await findRow(tx, id)
    await tx.delete(redirects).where(eq(redirects.id, id))
    await audit(
      actor,
      {
        action: "redirect.delete",
        entityType: "redirect",
        entityId: id,
        summary: `Removed redirect ${row.sourcePath} → ${row.destination}`,
      },
      tx
    )
  })
  invalidate(REDIRECT_TAGS)
  return { ok: true as const }
}
