import "server-only"

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

import type { Db } from "@/server/db/client"
import { media } from "@/server/db/schema"
import { probeImage } from "@/server/lib/media/probe"

import { seedId } from "./ids"

export const mediaRef = (url: string) => ({ mediaId: seedId("media", url) })

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
}

// Backgrounds and line art carry no information; everything else is flagged
// "needs alt" for an editor (docs/brief.md §6.7 step 2).
const DECORATIVE = new Set([
  "/images/hero/hero-bg.png",
  "/images/hero/hero-depth.png",
  "/images/hero/hero-hair.png",
  "/images/hero/navbar-bg.png",
  "/images/enterprise/enterprise-bg.png",
])

export async function seedMedia(db: Db, publicDir = "public") {
  const root = path.join(publicDir, "images")
  const files = (await readdir(root, { recursive: true })).filter(
    (f) => MIME[path.extname(f).toLowerCase()]
  )
  const rows = []
  for (const file of files) {
    const url = `/images/${file.split(path.sep).join("/")}`
    const absolute = path.join(root, file)
    const vector = url.endsWith(".svg")
    const probe = await probeImage(await readFile(absolute), {
      raster: !vector,
    })
    const decorative = vector || DECORATIVE.has(url)
    rows.push({
      id: seedId("media", url),
      driver: "static" as const,
      key: url,
      url,
      filename: path.basename(file),
      mimeType: MIME[path.extname(file).toLowerCase()],
      sizeBytes: (await stat(absolute)).size,
      ...probe,
      isDecorative: decorative,
      needsAlt: !decorative,
    })
  }
  await db.insert(media).values(rows).onConflictDoNothing()
  return rows.length
}
