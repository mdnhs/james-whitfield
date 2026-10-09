import "server-only"

import { and, inArray, isNull } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"
import type { DbLike } from "@/server/db/client"
import { media } from "@/server/db/schema"

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
