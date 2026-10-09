import "server-only"

import { eq } from "drizzle-orm"

import type { EditableGlobalKey } from "@/lib/content/global-access"
import { GLOBALS, parseGlobal } from "@/lib/content/globals"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, topLevelDiff } from "@/server/lib/conflict"
import {
  findRevision,
  listRevisions,
  writeRevision,
} from "@/server/lib/revisions"

async function findRow(db: DbLike, key: string, lock = false) {
  const query = db.select().from(settings).where(eq(settings.key, key)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  return row ?? null
}

export async function getGlobal(key: EditableGlobalKey) {
  const row = await findRow(getDb(), key)
  return {
    key,
    value: parseGlobal(key, row?.value),
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
  }
}

// Globals go live on save (docs/brief.md §6.5): validate, version-guard,
// snapshot (20 kept), audit with a field diff, expire the one tag.
export async function saveGlobal(
  actor: Actor,
  key: EditableGlobalKey,
  input: { version: number; value: unknown },
  note?: string
) {
  const parsed = GLOBALS[key].safeParse(input.value)
  if (!parsed.success) throw invalid(parsed.error)
  const value = parsed.data
  const saved = await getDb().transaction(async (tx) => {
    const before = await findRow(tx, key, true)
    if ((before?.version ?? 0) !== input.version) {
      throw await conflictError(tx, {
        version: before?.version ?? 0,
        updatedAt: before?.updatedAt ?? null,
        updatedBy: before?.updatedBy ?? null,
      })
    }
    const [row] = before
      ? await tx
          .update(settings)
          .set({
            value,
            version: before.version + 1,
            updatedBy: actor.userId,
            updatedAt: new Date(),
          })
          .where(eq(settings.key, key))
          .returning()
      : await tx
          .insert(settings)
          .values({ key, value, version: 1, updatedBy: actor.userId })
          .returning()
    await writeRevision(tx, {
      entityType: "setting",
      entityId: key,
      version: row!.version,
      snapshot: value,
      createdBy: actor.userId,
      note,
    })
    await audit(
      actor,
      {
        action: "globals.update",
        entityType: "setting",
        entityId: key,
        summary: note ?? `Updated ${key}`,
        diff: topLevelDiff(before?.value, value),
      },
      tx
    )
    return row!
  })
  invalidate([tags.setting(key)])
  return { key, value, version: saved.version, updatedAt: saved.updatedAt }
}

export const globalRevisions = (key: EditableGlobalKey) =>
  listRevisions(getDb(), "setting", key)

export async function restoreGlobal(
  actor: Actor,
  key: EditableGlobalKey,
  revisionId: string,
  version: number
) {
  const revision = await findRevision(getDb(), "setting", key, revisionId)
  if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
  // Re-validated by saveGlobal: an old snapshot may predate a schema change.
  return saveGlobal(
    actor,
    key,
    { version, value: revision.snapshot },
    `Restored version ${revision.version} of ${key}`
  )
}
