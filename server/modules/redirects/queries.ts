import "server-only"

import { eq } from "drizzle-orm"
import { cacheLife, cacheTag } from "next/cache"

import type { RouteTable } from "@/lib/seo/route-resolution"
import { getDb } from "@/server/db/client"
import { articles, pages, redirects } from "@/server/db/schema"
import { tags } from "@/server/lib/cache"

// Ruling R2: one small cached entry answers every proxy lookup until a
// publish, unpublish, address change or redirect write expires a tag.
export async function getRouteTable(): Promise<RouteTable> {
  "use cache"
  cacheTag(tags.routes, tags.articles, tags.redirects)
  cacheLife("max")
  const db = getDb()
  const [pageRows, articleRows, redirectRows] = await Promise.all([
    db
      .select({ path: pages.path })
      .from(pages)
      .where(eq(pages.status, "published")),
    db
      .select({ slug: articles.slug })
      .from(articles)
      .where(eq(articles.status, "published")),
    db
      .select({
        source: redirects.sourcePath,
        destination: redirects.destination,
        statusCode: redirects.statusCode,
      })
      .from(redirects)
      .where(eq(redirects.isActive, true)),
  ])
  return {
    live: [
      ...pageRows.map((r) => r.path),
      ...articleRows.map((r) => `/insights/${r.slug}`),
    ],
    redirects: Object.fromEntries(
      redirectRows.map((r) => [
        r.source,
        { destination: r.destination, statusCode: r.statusCode },
      ])
    ),
  }
}
