import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { getEnv } from "@/server/env"
import { getSitemapEntries } from "@/server/modules/seo/queries"

// docs/brief.md §11: published, indexable pages and articles. Request-time
// (connection) because the build has no database; the data is cached.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const origin = getEnv().SITE_URL.replace(/\/$/, "")
  return (await getSitemapEntries()).map((e) => ({
    url: e.path === "/" ? origin : `${origin}${e.path}`,
    lastModified: e.lastModified,
  }))
}
