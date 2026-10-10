import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { tags } from "@/server/lib/cache"

import { computeSeoHealth } from "./health"
import { isIndexable, listLiveEntities } from "./live"

// Callers have awaited connection(): the build has no database.
export async function getSitemapEntries() {
  "use cache"
  cacheTag(tags.routes, tags.articles)
  cacheLife("max")
  const live = await listLiveEntities()
  // Page SEO saves expire only page:<id> (noindex, canonical live there).
  for (const e of live) if (e.kind === "page") cacheTag(tags.page(e.id))
  return live
    .filter(isIndexable)
    .map((e) => ({ path: e.path, lastModified: e.updatedAt.toISOString() }))
}

// Ruling R11: cached; page SEO saves expire page:<id>, article SEO saves
// expire `articles`, media edits `media`, defaults `settings:seo`.
export async function getSeoHealth() {
  "use cache"
  cacheTag(tags.routes, tags.articles, tags.media, tags.setting("seo"))
  cacheLife("max")
  const live = await listLiveEntities()
  for (const e of live) if (e.kind === "page") cacheTag(tags.page(e.id))
  return computeSeoHealth(undefined, undefined, live)
}
