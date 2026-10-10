import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import sharp from "sharp"

import { readMediaBytes } from "@/server/lib/media/read"
import { MISS_LIFE, tags } from "@/server/lib/cache"
import { getSetting } from "@/server/modules/content/queries"
import * as repo from "@/server/modules/content/repo"

// A square, transparent-padded PNG of the site icon (Ruling R13). Cached
// per size until the site settings or the media library change.
export async function brandIcon(
  size: number
): Promise<Uint8Array<ArrayBuffer> | null> {
  "use cache"
  cacheTag(tags.setting("site"), tags.media)
  const site = await getSetting("site")
  const file = site.icon ? await repo.findMediaFile(site.icon.mediaId) : null
  const bytes = file ? await readMediaBytes(file) : null
  if (!bytes) {
    cacheLife(MISS_LIFE)
    return null
  }
  try {
    const png = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
    cacheLife("max")
    return new Uint8Array(png)
  } catch {
    cacheLife(MISS_LIFE)
    return null
  }
}
