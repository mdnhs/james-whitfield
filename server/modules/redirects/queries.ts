import "server-only"

import { and, eq } from "drizzle-orm"
import { cacheLife, cacheTag } from "next/cache"

import { categoryHref } from "@/lib/content/category-href"
import type { RouteTable } from "@/lib/seo/route-resolution"
import { getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  pages,
  redirects,
  services,
} from "@/server/db/schema"
import { tags } from "@/server/lib/cache"
import { notHiddenServicePage } from "@/server/modules/service-pages/visible"

// Ruling R2: one small cached entry answers every proxy lookup until a
// publish, unpublish, address change or redirect write expires a tag.
export async function getRouteTable(): Promise<RouteTable> {
  "use cache"
  cacheTag(
    tags.routes,
    tags.articles,
    tags.categories,
    tags.redirects,
    tags.collection("services")
  )
  cacheLife("max")
  const db = getDb()
  const [pageRows, articleRows, categoryRows, redirectRows, serviceRows] =
    await Promise.all([
      db
        .select({ path: pages.path })
        .from(pages)
        .where(and(eq(pages.status, "published"), notHiddenServicePage)),
      db
        .select({ slug: articles.slug })
        .from(articles)
        .where(eq(articles.status, "published")),
      db
        .select({ slug: articleCategories.slug })
        .from(articleCategories)
        .where(eq(articleCategories.isVisible, true)),
      db
        .select({
          source: redirects.sourcePath,
          destination: redirects.destination,
          statusCode: redirects.statusCode,
        })
        .from(redirects)
        .where(eq(redirects.isActive, true)),
      // Every visible service has /services/<slug>: its page, or a "coming
      // soon" placeholder until that page is published.
      db
        .select({ slug: services.slug })
        .from(services)
        .where(eq(services.isVisible, true)),
    ])
  return {
    live: [
      ...new Set([
        ...pageRows.map((r) => r.path),
        ...articleRows.map((r) => `/insights/${r.slug}`),
        ...categoryRows.map((r) => categoryHref(r.slug)),
        ...serviceRows.map((r) => `/services/${r.slug}`),
      ]),
    ],
    redirects: Object.fromEntries(
      redirectRows.map((r) => [
        r.source,
        { destination: r.destination, statusCode: r.statusCode },
      ])
    ),
  }
}
