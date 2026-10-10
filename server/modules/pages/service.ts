import "server-only"

import { and, asc, eq, sql } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import {
  kindOf,
  pageDocumentFor,
  type DraftDocument,
  type PageDocument,
  type PageMetaPatch,
} from "@/blocks/page"
import { hasPermission } from "@/lib/auth/permissions"
import type { NewPageInput } from "@/lib/content/page-path"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { pages } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, REDIRECT_TAGS, tags } from "@/server/lib/cache"
import { conflictError, userName } from "@/server/lib/conflict"
import {
  deleteRevisions,
  findRevision,
  listRevisions,
  writeRevision,
} from "@/server/lib/revisions"
import {
  assertMediaExists,
  assertShareImage,
} from "@/server/modules/media/assert-media"
import { recordPathChange } from "@/server/modules/redirects/service"

const changedSincePublish = sql<boolean>`${pages.draft} is distinct from ${pages.published}`
// Section ids in the working copy, for the link widget's anchor picker.
const draftAnchors = sql<
  string[]
>`coalesce((select jsonb_agg(b->>'anchor') from jsonb_array_elements(${pages.draft}->'blocks') as b), '[]'::jsonb)`

export async function listPages() {
  const rows = await getDb()
    .select({
      id: pages.id,
      path: pages.path,
      title: pages.title,
      status: pages.status,
      systemKey: pages.systemKey,
      updatedAt: pages.updatedAt,
      publishedAt: pages.publishedAt,
      settings: pages.settings,
      hasUnpublishedChanges: changedSincePublish,
      anchors: draftAnchors,
    })
    .from(pages)
    .orderBy(asc(pages.path))
  const items = rows.map(({ settings, ...row }) => ({
    ...row,
    needsReview: settings.needsReview === true,
  }))
  return { items, page: 1, pageSize: items.length, total: items.length }
}

async function findPage(db: DbLike, id: string, lock = false) {
  const query = db.select().from(pages).where(eq(pages.id, id)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  if (!row) throw new ApiError("NOT_FOUND", "That page doesn't exist")
  return row
}

// Optimistic lock (docs/brief.md §6.5): the write lands only on the version
// the editor started from; otherwise 409 with the current one.
async function writeIfVersion(
  db: DbLike,
  id: string,
  version: number,
  set: Partial<typeof pages.$inferInsert>
) {
  const [row] = await db
    .update(pages)
    .set({ ...set, version: sql`${pages.version} + 1` })
    .where(and(eq(pages.id, id), eq(pages.version, version)))
    .returning()
  if (row) return row
  throw await conflictError(db, await findPage(db, id))
}

export async function getPage(id: string) {
  const db = getDb()
  const row = await findPage(db, id)
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    status: row.status,
    systemKey: row.systemKey,
    kind: kindOf(row.systemKey),
    draft: row.draft,
    seo: row.seo,
    settings: row.settings,
    version: row.version,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    // Both sides come from jsonb, so key order is canonical.
    hasUnpublishedChanges:
      JSON.stringify(row.draft) !== JSON.stringify(row.published),
    updatedBy: await userName(db, row.updatedBy),
  }
}

// Autosave runs every ~1.2 s, so it is not audited: publish, discard,
// restore, create, delete and SEO changes are the audited events.
export async function saveDraft(
  actor: Actor,
  id: string,
  input: { version: number; document: DraftDocument }
) {
  const row = await writeIfVersion(getDb(), id, input.version, {
    // A draft may be half-finished; publish validates it fully.
    draft: input.document as unknown as PageDocument,
    updatedBy: actor.userId,
  })
  return { version: row.version, updatedAt: row.updatedAt }
}

export async function publishPage(actor: Actor, id: string, version: number) {
  const saved = await getDb().transaction(async (tx) => {
    const row = await findPage(tx, id, true)
    if (row.version !== version) throw await conflictError(tx, row)
    const parsed = pageDocumentFor(kindOf(row.systemKey)).safeParse(row.draft)
    if (!parsed.success) {
      throw invalid(
        parsed.error,
        "Fix the highlighted blocks before publishing"
      )
    }
    await assertMediaExists(tx, collectMediaIds(parsed.data))
    const [next] = await tx
      .update(pages)
      .set({
        draft: parsed.data,
        published: parsed.data,
        status: "published",
        publishedAt: new Date(),
        publishedBy: actor.userId,
        updatedBy: actor.userId,
        settings: { ...row.settings, needsReview: false },
        version: sql`${pages.version} + 1`,
      })
      .where(eq(pages.id, id))
      .returning()
    await writeRevision(tx, {
      entityType: "page",
      entityId: id,
      version: next!.version,
      snapshot: parsed.data,
      createdBy: actor.userId,
    })
    await audit(
      actor,
      {
        action: "page.publish",
        entityType: "page",
        entityId: id,
        summary: `Published ${row.path}`,
      },
      tx
    )
    return next!
  })
  // `routes` too: a visit while unpublished cached a miss under routes only.
  invalidate([tags.page(id), tags.routes])
  return { version: saved.version, publishedAt: saved.publishedAt }
}

export async function discardDraft(actor: Actor, id: string, version: number) {
  return getDb().transaction(async (tx) => {
    const current = await findPage(tx, id)
    if (!current.published) {
      throw new ApiError("BAD_REQUEST", "This page has never been published")
    }
    const row = await writeIfVersion(tx, id, version, {
      draft: current.published,
      updatedBy: actor.userId,
    })
    await audit(
      actor,
      {
        action: "page.discard",
        entityType: "page",
        entityId: id,
        summary: `Discarded unpublished changes on ${row.path}`,
      },
      tx
    )
    return { version: row.version }
  })
}

export async function restoreRevision(
  actor: Actor,
  id: string,
  revisionId: string,
  version: number
) {
  return getDb().transaction(async (tx) => {
    const revision = await findRevision(tx, "page", id, revisionId)
    if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
    const row = await writeIfVersion(tx, id, version, {
      draft: revision.snapshot as PageDocument,
      updatedBy: actor.userId,
    })
    await audit(
      actor,
      {
        action: "page.restore",
        entityType: "page",
        entityId: id,
        summary: `Loaded version ${revision.version} of ${row.path} into the draft`,
      },
      tx
    )
    return { version: row.version }
  })
}

export async function updateMeta(
  actor: Actor,
  id: string,
  patch: PageMetaPatch
) {
  if (patch.seo && !hasPermission(actor.roles, { seo: ["update"] })) {
    throw new ApiError("FORBIDDEN", "You can't change SEO settings")
  }
  if (
    (patch.title !== undefined || patch.settings) &&
    !hasPermission(actor.roles, { page: ["update"] })
  ) {
    throw new ApiError("FORBIDDEN", "You can't change this page")
  }
  const merge = (
    column: typeof pages.seo | typeof pages.settings,
    value?: object
  ) => (value ? sql`${column} || ${JSON.stringify(value)}::jsonb` : undefined)
  const saved = await getDb().transaction(async (tx) => {
    // Locked so a concurrent delete 404s instead of crashing below.
    const before = await findPage(tx, id, true)
    await assertMediaExists(tx, collectMediaIds(patch.seo ?? {}))
    await assertShareImage(tx, patch.seo?.ogImage)
    // Field-level merge, no version bump: SEO edits never conflict with an
    // editor's builder session.
    const [row] = await tx
      .update(pages)
      .set({
        title: patch.title,
        seo: merge(pages.seo, patch.seo),
        settings: merge(pages.settings, patch.settings),
        updatedBy: actor.userId,
      })
      .where(eq(pages.id, id))
      .returning()
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    if (patch.title !== undefined)
      diff.title = { from: before.title, to: patch.title }
    for (const [key, to] of Object.entries(patch.seo ?? {})) {
      diff[`seo.${key}`] = {
        from: (before.seo as Record<string, unknown>)[key] ?? null,
        to,
      }
    }
    for (const [key, to] of Object.entries(patch.settings ?? {})) {
      diff[`settings.${key}`] = {
        from: (before.settings as Record<string, unknown>)[key] ?? null,
        to,
      }
    }
    await audit(
      actor,
      {
        action: "page.meta",
        entityType: "page",
        entityId: id,
        summary: `Updated SEO and settings of ${before.path}`,
        diff,
      },
      tx
    )
    return row!
  })
  invalidate([tags.page(id)])
  return { title: saved.title, seo: saved.seo, settings: saved.settings }
}

export async function createPage(actor: Actor, input: NewPageInput) {
  const document: PageDocument = {
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "richtext",
        anchor: "content",
        chapter: null,
        hidden: false,
        joinPrevious: false,
        data: {
          doc: { type: "doc", content: [{ type: "paragraph" }] },
          width: "narrow",
        },
      },
    ],
  }
  const row = await getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(pages)
      .values({
        path: input.path,
        title: input.title,
        status: "draft",
        draft: document,
        settings: { showContactChapter: true, needsReview: false },
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .onConflictDoNothing({ target: pages.path })
      .returning()
    if (!created) {
      throw new ApiError("CONFLICT", "A page already lives at that address", {
        path: ["A page already lives at that address"],
      })
    }
    await audit(
      actor,
      {
        action: "page.create",
        entityType: "page",
        entityId: created.id,
        summary: `Created ${created.path}`,
      },
      tx
    )
    return created
  })
  // A visit before creation cached "no page here" under routes.
  invalidate([tags.routes])
  return { id: row.id, path: row.path }
}

export async function changePagePath(actor: Actor, id: string, path: string) {
  const result = await getDb().transaction(async (tx) => {
    const row = await findPage(tx, id, true)
    if (row.systemKey)
      throw new ApiError("FORBIDDEN", "System pages keep their address")
    if (row.path === path) return { path, redirected: false }
    const [taken] = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.path, path))
    if (taken)
      throw new ApiError("CONFLICT", "A page already lives at that address", {
        path: ["A page already lives at that address"],
      })
    await tx
      .update(pages)
      .set({ path, updatedBy: actor.userId })
      .where(eq(pages.id, id))
    const redirected = row.status === "published"
    if (redirected) {
      await recordPathChange(tx, {
        from: row.path,
        to: path,
        pageId: id,
        note: "Automatic: the page's address changed",
        createdBy: actor.userId,
      })
    }
    await audit(
      actor,
      {
        action: "page.path",
        entityType: "page",
        entityId: id,
        summary: `Moved ${row.path} to ${path}`,
        diff: { path: { from: row.path, to: path } },
      },
      tx
    )
    return { path, redirected }
  })
  invalidate([
    tags.page(id),
    tags.routes,
    ...(result.redirected ? REDIRECT_TAGS : []),
  ])
  return result
}

export async function deletePage(actor: Actor, id: string) {
  const db = getDb()
  const row = await findPage(db, id)
  if (row.systemKey) {
    throw new ApiError("FORBIDDEN", "System pages can't be deleted")
  }
  await db.transaction(async (tx) => {
    await deleteRevisions(tx, "page", id)
    await tx.delete(pages).where(eq(pages.id, id))
    await audit(
      actor,
      {
        action: "page.delete",
        entityType: "page",
        entityId: id,
        summary: `Deleted ${row.path}`,
      },
      tx
    )
  })
  invalidate([tags.page(id), tags.routes])
  return { ok: true as const }
}

export const pageRevisions = (id: string) => listRevisions(getDb(), "page", id)
