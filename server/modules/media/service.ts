import "server-only"

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import * as z from "zod"

import { hasPermission, type RoleName } from "@/lib/auth/permissions"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { media } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { isUniqueViolation, topLevelDiff } from "@/server/lib/conflict"
import {
  cleanFilename,
  MAX_UPLOAD_BYTES,
  processUpload,
} from "@/server/lib/media/process"
import { getStorage, variantKey } from "@/server/lib/media/storage"

import { MEDIA_REFERRERS, mediaUsage } from "./usage"

type MediaRow = typeof media.$inferSelect

export const MediaListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
  q: z.string().trim().max(80).optional(),
  type: z.enum(["image", "pdf"]).optional(),
  missingAlt: z.literal("1").optional(),
  // The picker resolves its current value(s) by id.
  ids: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined))
    .pipe(z.array(z.uuid()).max(100).optional()),
})
export const MediaPatch = z
  .object({
    alt: z.string().trim().max(300),
    caption: z.string().trim().max(500).nullable(),
    focalX: z.number().min(0).max(1),
    focalY: z.number().min(0).max(1),
    isDecorative: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change")

const toItem = (row: MediaRow) => ({
  id: row.id,
  url: row.url,
  filename: row.filename,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  width: row.width,
  height: row.height,
  blurDataUrl: row.blurDataUrl,
  dominantColor: row.dominantColor,
  alt: row.alt,
  caption: row.caption,
  focalX: row.focalX,
  focalY: row.focalY,
  isDecorative: row.isDecorative,
  needsAlt: row.needsAlt,
  createdAt: row.createdAt,
  createdBy: row.createdBy,
})

export type MediaItem = ReturnType<typeof toItem>

export async function listMedia(query: z.output<typeof MediaListQuery>) {
  const filters: SQL[] = [isNull(media.deletedAt)]
  if (query.q)
    filters.push(
      or(
        ilike(media.filename, `%${query.q}%`),
        ilike(media.alt, `%${query.q}%`)
      )!
    )
  if (query.type === "image") filters.push(like(media.mimeType, "image/%"))
  if (query.type === "pdf") filters.push(eq(media.mimeType, "application/pdf"))
  if (query.missingAlt)
    filters.push(
      and(
        eq(media.alt, ""),
        eq(media.isDecorative, false),
        like(media.mimeType, "image/%")
      )!
    )
  if (query.ids) filters.push(inArray(media.id, query.ids))
  const where = and(...filters)
  const db = getDb()
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt), desc(media.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ n: count() }).from(media).where(where),
  ])
  return {
    items: rows.map(toItem),
    page: query.page,
    pageSize: query.pageSize,
    total: total?.n ?? 0,
  }
}

async function findLive(id: string, db: DbLike = getDb(), lock = false) {
  const query = db
    .select()
    .from(media)
    .where(and(eq(media.id, id), isNull(media.deletedAt)))
    .limit(1)
  const [row] = lock ? await query.for("update") : await query
  if (!row) throw new ApiError("NOT_FOUND", "That file doesn't exist")
  return row
}

// docs/brief.md §7.2: media.update is "own" for authors. Any other role that
// holds it may edit every file. Checked here, server-side, on every write.
const OWN_ONLY: readonly RoleName[] = ["author"]
function mayEditAll(actor: Actor) {
  return hasPermission(
    actor.roles.filter((r) => !OWN_ONLY.includes(r)),
    { media: ["update"] }
  )
}
function assertMayEdit(actor: Actor, row: MediaRow) {
  if (!mayEditAll(actor) && row.createdBy !== actor.userId) {
    throw new ApiError("FORBIDDEN", "You can only edit files you uploaded")
  }
}

// Only when two writes race for the same key.
const duplicate = () =>
  new ApiError("CONFLICT", "That file is already in the library")

async function readUpload(file: File) {
  // Cheap early refusal; processUpload checks the real byte count again.
  if (file.size > MAX_UPLOAD_BYTES)
    throw new ApiError("PAYLOAD_TOO_LARGE", "Files can be up to 20 MB")
  const filename = cleanFilename(file.name)
  return {
    filename,
    processed: await processUpload(
      Buffer.from(await file.arrayBuffer()),
      filename
    ),
  }
}

// The same bytes under the same name (same key) are reused only when that
// row is live and this actor may edit it. Otherwise (soft-deleted, or another
// user's file an author could not edit) the upload gets its own row under a
// variant key, so nobody inherits stale alt text or someone else's file.
export async function uploadMedia(actor: Actor, file: File) {
  const { filename, processed } = await readUpload(file)
  const storage = getStorage()
  const [existing] = await getDb()
    .select()
    .from(media)
    .where(eq(media.key, processed.key))
    .limit(1)
  if (
    existing &&
    !existing.deletedAt &&
    (existing.createdBy === actor.userId || mayEditAll(actor))
  ) {
    return toItem(existing)
  }
  let key = existing ? variantKey(processed.key) : processed.key
  for (let attempt = 0; ; attempt++) {
    await storage.put(key, processed.body, processed.mimeType)
    try {
      const row = await getDb().transaction(async (tx) => {
        const [inserted] = await tx
          .insert(media)
          .values({
            driver: storage.name,
            key,
            url: storage.urlFor(key),
            filename,
            mimeType: processed.mimeType,
            sizeBytes: processed.sizeBytes,
            width: processed.width,
            height: processed.height,
            blurDataUrl: processed.blurDataUrl,
            dominantColor: processed.dominantColor,
            createdBy: actor.userId,
          })
          .returning()
        await audit(
          actor,
          {
            action: "media.upload",
            entityType: "media",
            entityId: inserted!.id,
            summary: `Uploaded ${inserted!.filename}`,
          },
          tx
        )
        return inserted!
      })
      invalidate([tags.media])
      return toItem(row)
    } catch (error) {
      // A concurrent identical upload took the key first: use a variant.
      if (!isUniqueViolation(error) || attempt > 0) throw error
      key = variantKey(processed.key)
    }
  }
}

export async function updateMedia(
  actor: Actor,
  id: string,
  patch: z.output<typeof MediaPatch>
) {
  const row = await getDb().transaction(async (tx) => {
    const before = await findLive(id, tx, true)
    assertMayEdit(actor, before)
    const [updated] = await tx
      .update(media)
      .set({ ...patch, ...(patch.alt !== undefined && { needsAlt: false }) })
      .where(eq(media.id, id))
      .returning()
    await audit(
      actor,
      {
        action: "media.update",
        entityType: "media",
        entityId: id,
        summary: `Updated ${before.filename}`,
        diff: topLevelDiff(
          Object.fromEntries(
            Object.keys(patch).map((k) => [k, before[k as keyof MediaRow]])
          ),
          patch
        ),
      },
      tx
    )
    return updated!
  })
  invalidate([tags.media])
  return toItem(row)
}

// docs/brief.md §14: replace keeps the id (and so every reference) and
// uploads under a new immutable key.
export async function replaceMedia(actor: Actor, id: string, file: File) {
  // Authorise before reading the upload, so a refused author costs no work.
  const current = await findLive(id)
  assertMayEdit(actor, current)
  const { filename, processed } = await readUpload(file)
  if (
    (current.mimeType === "application/pdf") !==
    (processed.mimeType === "application/pdf")
  ) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "Replace an image with an image, a PDF with a PDF",
      {
        file: ["Replace an image with an image, a PDF with a PDF"],
      }
    )
  }
  // Another row (often a soft-deleted one) may already hold this key: take
  // a variant rather than refusing a file the library does not show.
  const [holder] = await getDb()
    .select({ id: media.id })
    .from(media)
    .where(eq(media.key, processed.key))
    .limit(1)
  const key =
    holder && holder.id !== id ? variantKey(processed.key) : processed.key
  // Stored before the transaction (no network I/O under a row lock). Keys
  // are content-hashed, so a rolled-back replace leaves an unused file only.
  const storage = getStorage()
  await storage.put(key, processed.body, processed.mimeType)
  const row = await getDb().transaction(async (tx) => {
    const before = await findLive(id, tx, true)
    assertMayEdit(actor, before)
    let updated
    try {
      ;[updated] = await tx
        .update(media)
        .set({
          driver: storage.name,
          key,
          url: storage.urlFor(key),
          filename,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          width: processed.width,
          height: processed.height,
          blurDataUrl: processed.blurDataUrl,
          dominantColor: processed.dominantColor,
        })
        .where(eq(media.id, id))
        .returning()
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate()
      throw error
    }
    await audit(
      actor,
      {
        action: "media.replace",
        entityType: "media",
        entityId: id,
        summary: `Replaced ${before.filename} with ${filename}`,
        diff: topLevelDiff(
          { url: before.url, filename: before.filename },
          { url: updated!.url, filename }
        ),
      },
      tx
    )
    return updated!
  })
  invalidate([tags.media])
  return toItem(row)
}

export async function usageOf(id: string) {
  await findLive(id)
  return { items: await mediaUsage(getDb(), id) }
}

// Usage check and delete share one transaction. Locking every table the scan
// reads (share row exclusive, as collections' delete does for pages) makes a
// concurrent save that would add a reference wait until we commit; the media
// row itself is locked FOR UPDATE.
export async function deleteMedia(actor: Actor, id: string) {
  await getDb().transaction(async (tx) => {
    await tx.execute(
      sql`lock table ${MEDIA_REFERRERS} in share row exclusive mode`
    )
    const row = await findLive(id, tx, true)
    const usage = await mediaUsage(tx, id)
    if (usage.length > 0) {
      throw new ApiError("CONFLICT", "This file is still in use", undefined, {
        usage,
      })
    }
    // Soft delete: old revisions may still name it, and publish refuses
    // deleted media (server/modules/pages/service.ts).
    await tx
      .update(media)
      .set({ deletedAt: new Date() })
      .where(eq(media.id, id))
    await audit(
      actor,
      {
        action: "media.delete",
        entityType: "media",
        entityId: id,
        summary: `Deleted ${row.filename}`,
      },
      tx
    )
  })
  invalidate([tags.media])
  return { ok: true as const }
}
