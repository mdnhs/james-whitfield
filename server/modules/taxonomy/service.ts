import "server-only"

import { asc, count, eq, sql } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import {
  AuthorInput,
  CategoryInput,
  type Taxonomy,
} from "@/lib/content/taxonomy"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { articleCategories, articles, authors } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import {
  conflictError,
  isUniqueViolation,
  topLevelDiff,
} from "@/server/lib/conflict"
import { assertMediaExists } from "@/server/modules/media/assert-media"

// Both tables share id, slug, name, sort, is_visible and the stamps; typed
// through categories (like the collections registry), each one's own fields
// are enforced by its Zod schema. user_id on authors is never written here.
type Table = typeof articleCategories
type Row = Record<string, unknown>
const CONFIG = {
  categories: {
    table: articleCategories,
    tag: tags.categories,
    schema: CategoryInput,
    fk: articles.categoryId,
    noun: "category",
  },
  authors: {
    table: authors as unknown as Table,
    tag: tags.authors,
    schema: AuthorInput,
    fk: articles.authorId,
    noun: "author",
  },
} as const

const toRow = (name: Taxonomy, values: Row): Row => {
  if (name !== "authors") return values
  const { avatar, ...rest } = values
  return {
    ...rest,
    avatarId: (avatar as { mediaId: string } | null)?.mediaId ?? null,
  }
}
const fromRow = (name: Taxonomy, row: Row): Row => {
  if (name !== "authors") return row
  const { avatarId, ...rest } = row
  return { ...rest, avatar: avatarId ? { mediaId: avatarId } : null }
}
const slugTaken = () =>
  new ApiError("CONFLICT", "That slug is already used", {
    slug: ["That slug is already used"],
  })

function parse(name: Taxonomy, input: unknown) {
  const parsed = CONFIG[name].schema.safeParse(input)
  if (!parsed.success) throw invalid(parsed.error)
  return parsed.data as Row
}

async function findLocked(db: DbLike, name: Taxonomy, id: string) {
  const { table, noun } = CONFIG[name]
  const [row] = await db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1)
    .for("update")
  if (!row) throw new ApiError("NOT_FOUND", `That ${noun} doesn't exist`)
  return row
}

export async function listTaxonomy(name: Taxonomy) {
  const { table, fk } = CONFIG[name]
  const db = getDb()
  const rows = await db
    .select()
    .from(table)
    .orderBy(asc(table.sort), asc(table.name))
  const uses = await db
    .select({ id: fk, n: count() })
    .from(articles)
    .groupBy(fk)
  const used = new Map(uses.map((u) => [u.id, u.n]))
  return {
    items: rows.map((row) => ({
      ...fromRow(name, row),
      articleCount: used.get(row.id) ?? 0,
    })),
  }
}

export async function createTaxonomy(
  actor: Actor,
  name: Taxonomy,
  input: unknown
) {
  const { table, tag, noun } = CONFIG[name]
  const values = parse(name, input)
  try {
    const row = await getDb().transaction(async (tx) => {
      await assertMediaExists(tx, collectMediaIds(values))
      const [row] = await tx
        .insert(table)
        .values({
          ...toRow(name, values),
          createdBy: actor.userId,
          updatedBy: actor.userId,
        } as Table["$inferInsert"])
        .returning()
      await audit(
        actor,
        {
          action: `${noun}.create`,
          entityType: noun,
          entityId: row!.id,
          summary: `Created ${noun} ${row!.name}`,
        },
        tx
      )
      return row!
    })
    invalidate([tag])
    return fromRow(name, row)
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
}

export async function updateTaxonomy(
  actor: Actor,
  name: Taxonomy,
  id: string,
  input: { version: number; values: unknown }
) {
  const { table, tag, noun } = CONFIG[name]
  const values = parse(name, input.values)
  try {
    const row = await getDb().transaction(async (tx) => {
      const before = await findLocked(tx, name, id)
      if (before.version !== input.version)
        throw await conflictError(tx, before)
      await assertMediaExists(tx, collectMediaIds(values))
      const [row] = await tx
        .update(table)
        .set({
          ...toRow(name, values),
          updatedBy: actor.userId,
          version: sql`${table.version} + 1`,
        } as unknown as Partial<Table["$inferInsert"]>)
        .where(eq(table.id, id))
        .returning()
      await audit(
        actor,
        {
          action: `${noun}.update`,
          entityType: noun,
          entityId: id,
          summary: `Updated ${noun} ${row!.name}`,
          diff: topLevelDiff(fromRow(name, before), fromRow(name, row!)),
        },
        tx
      )
      return row!
    })
    invalidate([tag])
    return fromRow(name, row)
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken()
    throw error
  }
}

export async function deleteTaxonomy(actor: Actor, name: Taxonomy, id: string) {
  const { table, tag, fk, noun } = CONFIG[name]
  await getDb().transaction(async (tx) => {
    const row = await findLocked(tx, name, id)
    const [{ n }] = await tx
      .select({ n: count() })
      .from(articles)
      .where(eq(fk, id))
    if (n > 0)
      throw new ApiError(
        "CONFLICT",
        `This ${noun} is used by ${n} article${n === 1 ? "" : "s"}. Move them first.`
      )
    await tx.delete(table).where(eq(table.id, id))
    await audit(
      actor,
      {
        action: `${noun}.delete`,
        entityType: noun,
        entityId: id,
        summary: `Deleted ${noun} ${row.name}`,
      },
      tx
    )
  })
  invalidate([tag])
  return { ok: true as const }
}
