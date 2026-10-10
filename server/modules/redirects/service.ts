import "server-only"

import { and, eq, ne, sql } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"
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

const MAX_HOPS = 10
const LOOP = "That would create a redirect loop"
const pathOf = (target: string) => target.split("?")[0]!

// Ruling R5: where `to` finally lands, following active redirects.
async function finalTarget(db: DbLike, from: string, to: string) {
  const seen = new Set([from])
  let target = to
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (seen.has(pathOf(target))) {
      throw new ApiError("VALIDATION_FAILED", LOOP, { destination: [LOOP] })
    }
    seen.add(pathOf(target))
    const [next] = await db
      .select({ destination: redirects.destination })
      .from(redirects)
      .where(
        and(
          eq(redirects.sourcePath, pathOf(target)),
          eq(redirects.isActive, true)
        )
      )
      .limit(1)
    if (!next) return target
    target = next.destination
  }
  throw new ApiError("VALIDATION_FAILED", LOOP, { destination: [LOOP] })
}

// Every writer goes through here: the new row points at the final target,
// and every chain that ended at `from` now ends there directly.
export async function createRedirect(
  db: DbLike,
  entry: {
    from: string
    to: string
    statusCode?: number
    articleId?: string | null
    pageId?: string | null
    note: string
    createdBy: string | null
  }
) {
  if (entry.from === pathOf(entry.to)) return null
  const to = await finalTarget(db, entry.from, entry.to)
  // A switched-off row starting at the target stays as it is: repointing it
  // would make it point at itself.
  await db
    .update(redirects)
    .set({ destination: to })
    .where(
      and(
        eq(redirects.destination, entry.from),
        ne(redirects.sourcePath, pathOf(to))
      )
    )
  const values = {
    destination: to,
    statusCode: entry.statusCode ?? 301,
    isActive: true,
    articleId: entry.articleId ?? null,
    pageId: entry.pageId ?? null,
    note: entry.note,
  }
  await db
    .insert(redirects)
    .values({ sourcePath: entry.from, createdBy: entry.createdBy, ...values })
    .onConflictDoUpdate({ target: redirects.sourcePath, set: values })
  return { to }
}

// docs/brief.md §11 "created automatically when a slug changes" — articles
// and custom pages. Free the new path, then add old → new (which flattens).
export async function recordPathChange(
  db: DbLike,
  change: {
    from: string
    to: string
    articleId?: string | null
    pageId?: string | null
    note: string
    createdBy: string | null
  }
) {
  if (change.from === change.to) return
  await releasePath(db, change.to)
  await createRedirect(db, change)
}

// Ruling R7: after the response; hit counts are not cached, so no tag.
export async function recordHit(db: DbLike, sourcePath: string) {
  await db
    .update(redirects)
    .set({ hitCount: sql`${redirects.hitCount} + 1`, lastHitAt: new Date() })
    .where(eq(redirects.sourcePath, sourcePath))
}
