// server/modules/ai/flatten.ts
import "server-only"

import { plainText } from "@/lib/content/reading-time"

export const TEXT_LIMIT = 8000

// Keys that hold structure, not words a writer would read.
const SKIP = new Set([
  "id",
  "type",
  "anchor",
  "mediaId",
  "href",
  "url",
  "src",
  "slug",
  "variant",
  "kind",
  "layout",
  "icon",
  "tone",
  "focal",
  "hidden",
  "joinPrevious",
])
const NOT_PROSE = /^(https?:|\/|#)|^[0-9a-f-]{36}$/i

export function clip(text: string, limit = TEXT_LIMIT) {
  return text.length > limit
    ? { text: text.slice(0, limit), truncated: true }
    : { text, truncated: false }
}

export function flattenBlocks(doc: unknown, limit = TEXT_LIMIT) {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      const t = node.trim()
      if (t && /\p{L}/u.test(t) && !NOT_PROSE.test(t)) out.push(t)
      return
    }
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== "object") return
    const obj = node as Record<string, unknown>
    if (obj.type === "doc") {
      const t = plainText(obj)
      if (t) out.push(t)
      return
    }
    for (const [key, value] of Object.entries(obj))
      if (!SKIP.has(key)) walk(value)
  }
  // A page document is `{ blocks: [...] }`; anything else reads as empty.
  const blocks =
    doc && typeof doc === "object"
      ? (doc as { blocks?: unknown }).blocks
      : undefined
  if (Array.isArray(blocks)) walk(blocks)
  return clip(out.join("\n"), limit)
}
