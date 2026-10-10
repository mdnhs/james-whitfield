import "server-only"

import { eq } from "drizzle-orm"

import { hasPermission } from "@/lib/auth/permissions"
import { slugify } from "@/lib/utils"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import type { DbLike } from "@/server/db/client"
import { articles, authors } from "@/server/db/schema"

type Row = Pick<
  typeof articles.$inferSelect,
  "createdBy" | "authorId" | "status" | "publishedAt"
>

// Editors and up (article.publish) work on any article; everyone else only
// on articles they created or that list them as author (docs/brief.md §7.2).
export const canPublish = (actor: Actor) =>
  hasPermission(actor.roles, { article: ["publish"] })

async function linkedUser(db: DbLike, authorId: string | null) {
  if (!authorId) return null
  const [row] = await db
    .select({ userId: authors.userId })
    .from(authors)
    .where(eq(authors.id, authorId))
    .limit(1)
  return row?.userId ?? null
}

export async function isOwn(
  db: DbLike,
  actor: Actor,
  row: Row,
  draftAuthorId: string | null = null
) {
  if (row.createdBy === actor.userId) return true
  if ((await linkedUser(db, row.authorId)) === actor.userId) return true
  return (
    draftAuthorId !== null &&
    (await linkedUser(db, draftAuthorId)) === actor.userId
  )
}

export async function assertCanEdit(
  db: DbLike,
  actor: Actor,
  row: Row,
  draftAuthorId: string | null = null
) {
  if (canPublish(actor) || (await isOwn(db, actor, row, draftAuthorId))) return
  throw new ApiError("FORBIDDEN", "You can only edit your own articles")
}

// "own drafts" (§7.2): never published, still a draft.
export function assertCanDelete(actor: Actor, row: Row) {
  if (canPublish(actor)) return
  if (row.status === "draft" && row.publishedAt === null) return
  throw new ApiError(
    "FORBIDDEN",
    "Only drafts that were never published can be deleted"
  )
}

// Ruling R4: a writer's byline is their own authors row, made on first use.
export async function ownAuthorId(db: DbLike, actor: Actor) {
  const [mine] = await db
    .select({ id: authors.id })
    .from(authors)
    .where(eq(authors.userId, actor.userId))
    .limit(1)
  if (mine) return mine.id
  const base = slugify(actor.name) || "author"
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const [row] = await db
      .insert(authors)
      .values({
        slug,
        name: actor.name,
        userId: actor.userId,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .onConflictDoNothing({ target: authors.slug })
      .returning({ id: authors.id })
    if (row) return row.id
  }
}
