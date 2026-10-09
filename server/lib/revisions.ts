import "server-only"

import { and, desc, eq, notInArray } from "drizzle-orm"

import type { DbLike } from "@/server/db/client"
import { revisions, users } from "@/server/db/schema"

// docs/brief.md §6.5: 50 publish snapshots per page, 20 per global.
export const REVISION_LIMITS = { page: 50, setting: 20 } as const
export type RevisionEntity = keyof typeof REVISION_LIMITS

const of = (entityType: RevisionEntity, entityId: string) =>
  and(eq(revisions.entityType, entityType), eq(revisions.entityId, entityId))

// Rows written in one transaction share created_at, so version breaks ties.
const newestFirst = [desc(revisions.createdAt), desc(revisions.version)]

export async function writeRevision(
  db: DbLike,
  entry: {
    entityType: RevisionEntity
    entityId: string
    version: number
    snapshot: unknown
    createdBy: string
    note?: string | null
  }
) {
  await db.insert(revisions).values({ ...entry, note: entry.note ?? null })
  const keep = db
    .select({ id: revisions.id })
    .from(revisions)
    .where(of(entry.entityType, entry.entityId))
    .orderBy(...newestFirst)
    .limit(REVISION_LIMITS[entry.entityType])
  await db
    .delete(revisions)
    .where(
      and(of(entry.entityType, entry.entityId), notInArray(revisions.id, keep))
    )
}

export async function listRevisions(
  db: DbLike,
  entityType: RevisionEntity,
  entityId: string
) {
  const items = await db
    .select({
      id: revisions.id,
      version: revisions.version,
      note: revisions.note,
      createdAt: revisions.createdAt,
      createdBy: users.name,
    })
    .from(revisions)
    .leftJoin(users, eq(revisions.createdBy, users.id))
    .where(of(entityType, entityId))
    .orderBy(...newestFirst)
  return { items }
}

export async function findRevision(
  db: DbLike,
  entityType: RevisionEntity,
  entityId: string,
  id: string
) {
  const [row] = await db
    .select()
    .from(revisions)
    .where(and(of(entityType, entityId), eq(revisions.id, id)))
    .limit(1)
  return row ?? null
}

export async function deleteRevisions(
  db: DbLike,
  entityType: RevisionEntity,
  entityId: string
) {
  await db.delete(revisions).where(of(entityType, entityId))
}
