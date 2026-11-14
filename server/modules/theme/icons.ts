import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import sharp from "sharp"

import { icoToPng } from "@/server/lib/media/formats"
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
    // sharp reads SVG but not ICO: start from the icon's largest image.
    const isIco = bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1
    const source = isIco ? await icoToPng(Buffer.from(bytes)) : bytes
    if (!source) throw new Error("ico without a readable image")
    const png = await sharp(source, { limitInputPixels: 40_000_000 })
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

// The animated logo's Lottie JSON, only while it is switched on (Appearance).
// Same-origin, because the media host sends no CORS headers. Cached until
// the site settings or the media library change.
export async function brandLottie(): Promise<string | null> {
  "use cache"
  cacheTag(tags.setting("site"), tags.media)
  const site = await getSetting("site")
  const ref = site.logoLottieEnabled ? site.logoLottie : null
  const file = ref ? await repo.findMediaFile(ref.mediaId) : null
  const bytes = file ? await readMediaBytes(file) : null
  try {
    if (!bytes) throw new Error("no lottie")
    const text = bytes.toString("utf8")
    // A replaced row could hold any file: serve bodymovin JSON only.
    const data = JSON.parse(text) as { layers?: unknown }
    if (!Array.isArray(data.layers)) throw new Error("not a lottie")
    cacheLife("max")
    return text
  } catch {
    cacheLife(MISS_LIFE)
    return null
  }
}
