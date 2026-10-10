import "server-only"

import { eq, sql } from "drizzle-orm"

import type { DbLike } from "@/server/db/client"
import { redirects } from "@/server/db/schema"

// A path that is live again must not redirect away (Review Focus 1).
// Reports whether a redirect was removed, so the caller can expire the tag.
export async function releasePath(db: DbLike, path: string) {
  const gone = await db
    .delete(redirects)
    .where(eq(redirects.sourcePath, path))
    .returning({ id: redirects.id })
  return gone.length > 0
}

export async function createRedirect(
  db: DbLike,
  entry: {
    from: string
    to: string
    articleId: string | null
    note: string
    createdBy: string | null
  }
) {
  if (entry.from === entry.to) return
  await db
    .insert(redirects)
    .values({
      sourcePath: entry.from,
      destination: entry.to,
      statusCode: 301,
      articleId: entry.articleId,
      note: entry.note,
      createdBy: entry.createdBy,
    })
    .onConflictDoUpdate({
      target: redirects.sourcePath,
      set: {
        destination: entry.to,
        statusCode: 301,
        isActive: true,
        articleId: entry.articleId,
        note: entry.note,
      },
    })
}

// docs/brief.md §11: "created automatically when a slug changes". Order
// matters: free the new path first, then point every chain that ended at the
// old path straight at the new one, then add old → new.
export async function recordSlugChange(
  db: DbLike,
  change: {
    articleId: string
    from: string
    to: string
    createdBy: string | null
  }
) {
  if (change.from === change.to) return
  await releasePath(db, change.to)
  await db
    .update(redirects)
    .set({ destination: change.to })
    .where(eq(redirects.destination, change.from))
  await createRedirect(db, {
    from: change.from,
    to: change.to,
    articleId: change.articleId,
    note: "Automatic: the article's slug changed",
    createdBy: change.createdBy,
  })
}

// Ruling R7: after the response; hit counts are not cached, so no tag.
export async function recordHit(db: DbLike, sourcePath: string) {
  await db
    .update(redirects)
    .set({ hitCount: sql`${redirects.hitCount} + 1`, lastHitAt: new Date() })
    .where(eq(redirects.sourcePath, sourcePath))
}
