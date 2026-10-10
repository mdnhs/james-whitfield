import "server-only"

import { eq } from "drizzle-orm"
import { cacheLife, cacheTag } from "next/cache"

import { getDb } from "@/server/db/client"
import { redirects } from "@/server/db/schema"
import { tags } from "@/server/lib/cache"

// The whole active map is small; one cached entry serves every lookup until a
// write expires `redirects` (docs/brief.md §5.6 tag catalogue).
export async function getRedirectTable() {
  "use cache"
  cacheTag(tags.redirects)
  cacheLife("max")
  const rows = await getDb()
    .select({
      source: redirects.sourcePath,
      destination: redirects.destination,
      statusCode: redirects.statusCode,
    })
    .from(redirects)
    .where(eq(redirects.isActive, true))
  return Object.fromEntries(
    rows.map((r) => [
      r.source,
      { destination: r.destination, statusCode: r.statusCode },
    ])
  )
}
