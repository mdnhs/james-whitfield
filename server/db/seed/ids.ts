import "server-only"

import { createHash } from "node:crypto"

// Deterministic ids keep seeded rows, and the block documents that point at
// them, identical on every run (docs/brief.md §6.7: upsert by stable keys).
// Shaped as an RFC 9562 v4 uuid so uuid columns and z.uuid() accept it.
export function seedId(kind: string, key: string) {
  const h = createHash("sha256").update(`mk-seed:${kind}:${key}`).digest("hex")
  const variant = ((Number.parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}
