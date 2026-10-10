import "server-only"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"
import type { DbLike } from "@/server/db/client"
import { media } from "@/server/db/schema"
import { isShareImageSize, SHARE_IMAGE_MESSAGE } from "@/lib/seo/share-image"

// Live-on-save writes (globals, collections, SEO) and publish must not name
// deleted or unknown images: reject with a field error instead of a FK 500 or
// a silently broken public reference.
export async function assertMediaExists(db: DbLike, ids: string[]) {
  if (ids.length === 0) return
  // Malformed ids would make the uuid column comparison throw.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const valid = ids.filter((id) => UUID.test(id))
  const found = valid.length
    ? await db
        .select({ id: media.id })
        .from(media)
        .where(and(inArray(media.id, valid), isNull(media.deletedAt)))
    : []
  const missing = ids.filter((id) => !found.some((row) => row.id === id))
  if (missing.length > 0) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "Some images were deleted. Choose new ones before saving.",
      { _media: missing.map((id) => `Image ${id} no longer exists`) }
    )
  }
}

// Ruling R13: a custom share image must be at least 1200×630 at 1.91:1.
export async function assertShareImage(
  db: DbLike,
  ref: { mediaId: string } | null | undefined
) {
  if (!ref) return
  const [row] = await db
    .select({
      width: media.width,
      height: media.height,
      mimeType: media.mimeType,
    })
    .from(media)
    .where(eq(media.id, ref.mediaId))
    .limit(1)
  const ok =
    row?.mimeType.startsWith("image/") &&
    row.width !== null &&
    row.height !== null &&
    isShareImageSize({ width: row.width, height: row.height })
  if (!ok) {
    throw new ApiError("VALIDATION_FAILED", SHARE_IMAGE_MESSAGE, {
      ogImage: [SHARE_IMAGE_MESSAGE],
    })
  }
}
