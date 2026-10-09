import "server-only"

import { and, asc, desc, eq, sql } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import { hasPermission } from "@/lib/auth/permissions"
import {
  COLLECTION_SCHEMAS,
  type CollectionSlug,
  type OptionSource,
} from "@/lib/content/collections"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { articleCategories, articles } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import {
  conflictError,
  isUniqueViolation,
  topLevelDiff,
} from "@/server/lib/conflict"
import { assertMediaExists } from "@/server/modules/media/assert-media"

import {
  entryFor,
  fromRow,
  titleOf,
  toRow,
  type SharedInsert,
} from "./registry"
import { collectionUsage } from "./usage"

type Row = Record<string, unknown> & {
  id: string
  sort: number
  version: number
  updatedAt: Date
}

const toItem = (name: CollectionSlug, row: Row, usedOn: string[]) => ({
  id: row.id,
  sort: row.sort,
  version: row.version,
  updatedAt: row.updatedAt,
  title: titleOf(name, row),
  values: fromRow(name, row),
  usedOn,
})

export async function listItems(name: CollectionSlug) {
  const e = entryFor(name)
  const db = getDb()
  const [rows, usage] = await Promise.all([
    db.select().from(e.table).orderBy(asc(e.table.sort)),
    collectionUsage(db),
  ])
  const items = rows.map((row) => toItem(name, row, usage(e.tag, row.id).shown))
  return { items, page: 1, pageSize: items.length, total: items.length }
}

function parseValues(name: CollectionSlug, values: unknown) {
  const parsed = COLLECTION_SCHEMAS[name].safeParse(values)
  if (!parsed.success) throw invalid(parsed.error)
  return {
    row: toRow(name, parsed.data as Record<string, unknown>),
    mediaIds: collectMediaIds(parsed.data),
  }
}

const slugTaken = () =>
  new ApiError("CONFLICT", "That slug is already used", {
    slug: ["That slug is already used"],
  })

export async function createItem(
  actor: Actor,
  name: CollectionSlug,
  values: unknown
) {
  const e = entryFor(name)
  const { row, mediaIds } = parseValues(name, values)
  try {
    const created = await getDb().transaction(async (tx) => {
      await assertMediaExists(tx, mediaIds)
      const [last] = await tx
        .select({ next: sql<number>`coalesce(max(${e.table.sort}), -1) + 1` })
        .from(e.table)
      const [inserted] = await tx
        .insert(e.table)
        .values({
          ...(row as SharedInsert),
          sort: last?.next ?? 0,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        })
        .returning()
      await audit(
        actor,
        {
          action: "collection.create",
          entityType: name,
          entityId: inserted!.id,
          summary: `Added "${titleOf(name, inserted!)}" to ${name}`,
        },
        tx
      )
      return inserted!
    })
    invalidate([tags.collection(e.tag)])
    return toItem(name, created, [])
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
}

async function findItem(name: CollectionSlug, id: string) {
  const e = entryFor(name)
  const [row] = await getDb()
    .select()
    .from(e.table)
    .where(eq(e.table.id, id))
    .limit(1)
  if (!row) throw new ApiError("NOT_FOUND", "That item doesn't exist")
  return row
}

// PATCH sends only what changed (a visibility toggle sends one field); the
// merged result must still pass the full schema.
export async function updateItem(
  actor: Actor,
  name: CollectionSlug,
  id: string,
  input: { version: number; values: Record<string, unknown> }
) {
  const e = entryFor(name)
  const current = await findItem(name, id)
  const before = fromRow(name, current)
  const { row, mediaIds } = parseValues(name, { ...before, ...input.values })
  let updated
  try {
    updated = await getDb().transaction(async (tx) => {
      await assertMediaExists(tx, mediaIds)
      const [next] = await tx
        .update(e.table)
        .set({
          ...(row as Partial<SharedInsert>),
          updatedBy: actor.userId,
          version: sql`${e.table.version} + 1`,
        })
        .where(and(eq(e.table.id, id), eq(e.table.version, input.version)))
        .returning()
      if (!next) return null
      await audit(
        actor,
        {
          action: "collection.update",
          entityType: name,
          entityId: id,
          summary: `Updated "${titleOf(name, next)}" in ${name}`,
          diff: topLevelDiff(before, fromRow(name, next)),
        },
        tx
      )
      return next
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
  if (!updated) throw await conflictError(getDb(), await findItem(name, id))
  invalidate([tags.collection(e.tag)])
  return toItem(name, updated, [])
}

// Usage check and delete share one transaction. LOCK TABLE pages (share row
// exclusive) makes a concurrent page save or create wait until we commit, so
// no reference can appear between the check and the delete; the row itself
// is locked FOR UPDATE.
export async function deleteItem(
  actor: Actor,
  name: CollectionSlug,
  id: string
) {
  const e = entryFor(name)
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`lock table pages in share row exclusive mode`)
    const [row] = await tx
      .select()
      .from(e.table)
      .where(eq(e.table.id, id))
      .for("update")
      .limit(1)
    if (!row) throw new ApiError("NOT_FOUND", "That item doesn't exist")
    const { named } = (await collectionUsage(tx))(e.tag, id)
    // Foreign keys from other tables: categories point at a service.
    const used = [...named]
    if (name === "services") {
      const cats = await tx
        .select({ name: articleCategories.name })
        .from(articleCategories)
        .where(eq(articleCategories.relatedServiceId, id))
      used.push(...cats.map((c) => `Category: ${c.name}`))
    }
    if (used.length > 0) {
      throw new ApiError(
        "CONFLICT",
        `Still used on ${used.join(", ")}`,
        undefined,
        { usedOn: used }
      )
    }
    await tx.delete(e.table).where(eq(e.table.id, id))
    await audit(
      actor,
      {
        action: "collection.delete",
        entityType: name,
        entityId: id,
        summary: `Deleted "${titleOf(name, row)}" from ${name}`,
      },
      tx
    )
  })
  invalidate([tags.collection(entryFor(name).tag)])
  return { ok: true as const }
}

export async function reorderItems(
  actor: Actor,
  name: CollectionSlug,
  ids: string[]
) {
  const e = entryFor(name)
  const db = getDb()
  const known = new Set(
    (await db.select({ id: e.table.id }).from(e.table)).map((r) => r.id)
  )
  const complete =
    ids.length === known.size &&
    new Set(ids).size === ids.length &&
    ids.every((id) => known.has(id))
  if (!complete) {
    throw new ApiError("VALIDATION_FAILED", "Send every item exactly once", {
      ids: ["Send every item exactly once"],
    })
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(e.table).set({ sort: index }).where(eq(e.table.id, id))
    }
    await audit(
      actor,
      {
        action: "collection.reorder",
        entityType: name,
        summary: `Reordered ${name}`,
      },
      tx
    )
  })
  invalidate([tags.collection(e.tag)])
  return { ok: true as const }
}

export async function itemOptions(actor: Actor, source: OptionSource) {
  if (source === "articles") {
    if (!hasPermission(actor.roles, { article: ["read"] })) {
      throw new ApiError("FORBIDDEN", "You don't have permission to do that")
    }
    const rows = await getDb()
      .select({ id: articles.id, label: articles.title })
      .from(articles)
      .orderBy(desc(articles.publishedAt))
    return { items: rows }
  }
  const e = entryFor(source)
  const rows = await getDb().select().from(e.table).orderBy(asc(e.table.sort))
  return {
    items: rows.map((row) => ({ id: row.id, label: titleOf(source, row) })),
  }
}
